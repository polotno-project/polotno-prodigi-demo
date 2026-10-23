// Backend for the Polotno + Prodigi demo.
//
// The editor runs in the browser, so it cannot hold the Prodigi credentials.
// This server holds them and exposes:
//
//   GET /health
//   GET /prodigi/product
//   POST /prodigi/order
//
// Env:
//   PRODIGI_SANDBOX_API_KEY
//   PUBLIC_URL      this server's public URL; the provider downloads print files from it
//   ALLOWED_ORIGINS comma-separated, defaults to localhost:5173

import http from 'node:http';
import { randomUUID } from 'node:crypto';

const env = process.env;
const PORT = Number(env.PORT || 8787);
const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ALLOWED_ORIGINS = (
  env.ALLOWED_ORIGINS ||
  'http://localhost:5173'
).split(',');

const MAX_BODY = 25 * 1024 * 1024;
const FILE_TTL_MS = 10 * 60 * 1000;

// --- helpers ------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cached(fn, ttlMs = 60 * 60 * 1000) {
  const cache = new Map();
  return async (key) => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await fn(key);
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  };
}

async function api(base, token, path, { method = 'GET', body, headers = {} } = {}) {
  // A provider with its own auth header passes Authorization: undefined.
  const allHeaders = Object.fromEntries(
    Object.entries({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }).filter(
      ([, v]) => v !== undefined
    )
  );
  const res = await fetch(base + path, {
    method,
    headers: allHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const detail = json?.error?.message || json?.message || json?.result || text;
    throw new HttpError(502, `${method} ${path} failed (${res.status}): ${detail}`);
  }
  return json;
}

// --- temporary file hosting (Prodigi downloads print files by URL) -----------

const files = new Map();

const FILE_TYPES = { png: 'image/png', pdf: 'application/pdf' };

function hostFile(base64, ext = 'png') {
  const id = randomUUID();
  files.set(id, { data: Buffer.from(base64, 'base64'), ext, expires: Date.now() + FILE_TTL_MS });
  return `${PUBLIC_URL}/files/${id}.${ext}`;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, f] of files) if (f.expires < now) files.delete(id);
}, 60 * 1000).unref();

// --- Prodigi ----------------------------------------------------------------------

// Prodigi's sandbox takes real orders, downloads and checks the artwork, and
// never prints. The demo cancels each order once Prodigi has read the file.
const PRODIGI_API = (env.PRODIGI_API || 'https://api.sandbox.prodigi.com/v4.0').replace(/\/$/, '');
// Classic framed fine art print, mounted, 40 × 50 cm.
const PRODIGI_SKU = env.PRODIGI_SKU || 'GLOBAL-CFPM-16X20';

const PRODIGI_BUYERS = {
  US: { townOrCity: 'New York', postalOrZipCode: '10001', line1: '350 5th Ave', stateOrCounty: 'NY' },
  GB: { townOrCity: 'London', postalOrZipCode: 'SW1A 1AA', line1: '10 Downing St' },
  DE: { townOrCity: 'Berlin', postalOrZipCode: '10117', line1: 'Unter den Linden 1' },
  AU: { townOrCity: 'Sydney', postalOrZipCode: '2000', line1: '1 Macquarie St', stateOrCounty: 'NSW' },
};

const prodigi = (path, opts = {}) => {
  if (!env.PRODIGI_SANDBOX_API_KEY) throw new HttpError(503, 'PRODIGI_SANDBOX_API_KEY is not set');
  return api(PRODIGI_API, null, path, {
    ...opts,
    headers: { Authorization: undefined, 'X-API-Key': env.PRODIGI_SANDBOX_API_KEY },
  });
};

const prodigiProduct = cached(async () => {
  const { product } = await prodigi(`/products/${PRODIGI_SKU}`);
  const size = product.variants?.[0]?.printAreaSizes?.default;
  return {
    sku: product.sku,
    description: product.description,
    widthCm: product.productDimensions?.width,
    heightCm: product.productDimensions?.height,
    widthPx: size?.horizontalResolution,
    heightPx: size?.verticalResolution,
    frameColors: product.attributes?.color || [],
  };
});

async function prodigiOrder(body) {
  const png = String(body?.png || '').replace(/^data:image\/png;base64,/, '');
  if (!png.startsWith('iVBOR')) throw new HttpError(400, 'png is not a PNG');
  const product = await prodigiProduct('product');
  const color = product.frameColors.includes(body?.color) ? body.color : 'black';
  const country = PRODIGI_BUYERS[body?.country] ? body.country : 'GB';
  const item = { sku: product.sku, copies: 1, attributes: { color }, assets: [{ printArea: 'default' }] };

  const quoteBody = (c) => ({ shippingMethod: 'Standard', destinationCountryCode: c, currencyCode: 'EUR', items: [item] });
  const quotes = await Promise.all(
    Object.keys(PRODIGI_BUYERS).map(async (c) => {
      const q = (await prodigi('/quotes', { method: 'POST', body: quoteBody(c) })).quotes?.[0];
      const shipment = q?.shipments?.[0];
      return {
        country: c,
        city: PRODIGI_BUYERS[c].townOrCity,
        printedIn: shipment?.fulfillmentLocation?.countryCode,
        lab: shipment?.fulfillmentLocation?.labCode,
        price: Number(q?.costSummary?.items?.amount),
        shipping: Number(q?.costSummary?.shipping?.amount),
        carrier: shipment ? `${shipment.carrier?.name} ${shipment.carrier?.service || ''}`.trim() : null,
        currency: q?.costSummary?.totalCost?.currency,
      };
    })
  );

  const orderBody = {
    merchantReference: `polotno-demo-${Date.now()}-${randomUUID().slice(0, 8)}`,
    shippingMethod: 'Standard',
    recipient: {
      name: 'Polotno Demo',
      email: 'demo@polotno.com',
      address: { countryCode: country, ...PRODIGI_BUYERS[country] },
    },
    items: [{ ...item, sizing: 'fillPrintArea', assets: [{ printArea: 'default', url: hostFile(png, 'png') }] }],
  };
  const created = await prodigi('/orders', { method: 'POST', body: orderBody });
  let order = created.order;

  // Prodigi downloads the artwork right after the order is created. Wait for
  // that step so the demo can show what Prodigi found.
  for (let i = 0; i < 15 && order?.id; i++) {
    const asset = order.status?.details?.downloadAssets;
    if (asset && asset !== 'NotStarted' && asset !== 'InProgress') break;
    await sleep(2000);
    order = (await prodigi(`/orders/${order.id}`)).order;
  }
  const cancel = order?.id
    ? await prodigi(`/orders/${order.id}/actions/cancel`, { method: 'POST', body: {} }).catch((e) => ({ error: e.message }))
    : null;

  return {
    product: { ...product, color },
    country,
    quotes,
    order: {
      id: order?.id,
      stage: order?.status?.stage,
      details: order?.status?.details,
      issues: order?.status?.issues || [],
      cancelled: cancel?.order?.status?.stage === 'Cancelled' || cancel?.outcome === 'Cancelled',
    },
    requests: [
      {
        title: `Quote the framed print for a buyer in each country (${quotes.length} calls)`,
        endpoint: `POST ${PRODIGI_API}/quotes`,
        body: quoteBody(country),
        response: quotes.find((q) => q.country === country),
      },
      {
        title: 'Create the order with the print file (sandbox: never printed)',
        endpoint: `POST ${PRODIGI_API}/orders`,
        body: orderBody,
        response: { outcome: created.outcome, order: { id: order?.id, status: order?.status } },
      },
    ],
  };
}

// --- rate limit -----------------------------------------------------------------

const hits = new Map();
function rateLimit(ip, limit = 12, windowMs = 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new HttpError(429, 'Too many requests, try again in a minute');
  recent.push(now);
  hits.set(ip, recent);
}

// --- server ---------------------------------------------------------------------

const routes = {
  'GET /health': async () => ({ ok: true }),
  'GET /prodigi/product': () => prodigiProduct('product'),
  'POST /prodigi/order': (body) => prodigiOrder(body),
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Design too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(new HttpError(400, 'Body is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const file = url.pathname.match(/^\/files\/([0-9a-f-]+)\.(png|pdf)$/);
  if (req.method === 'GET' && file) {
    const f = files.get(file[1]);
    if (!f || f.ext !== file[2]) return res.writeHead(404).end();
    return res.writeHead(200, { 'Content-Type': FILE_TYPES[f.ext] }).end(f.data);
  }

  const route = routes[`${req.method} ${url.pathname}`];
  try {
    if (!route) throw new HttpError(404, 'Not found');
    if (req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
        .split(',')[0]
        .trim();
      rateLimit(ip);
    }
    const body = req.method === 'POST' ? await readBody(req) : null;
    const result = await route(body, url.searchParams);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(req.method, url.pathname, e.message);
    res
      .writeHead(status, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => console.log(`pod-proxy listening on ${PORT}`));
