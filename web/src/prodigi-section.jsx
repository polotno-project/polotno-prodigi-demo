import React from 'react';
import { SectionTab } from 'polotno/side-panel';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from 'polotno/primitives';

// Prodigi tab: export the print at Prodigi's exact pixel size and send it,
// through the demo backend that holds the Prodigi key, to Prodigi's sandbox.
// Prodigi quotes the framed print for buyers in four countries, showing which
// lab would print each one, then takes a sandbox order, downloads the file and
// checks it. Sandbox orders are never printed, and the backend cancels it.

const API = (import.meta.env.VITE_POD_API || 'http://localhost:8787').replace(/\/$/, '');

const COUNTRIES = { GB: 'United Kingdom', US: 'United States', DE: 'Germany', AU: 'Australia' };
const FRAMES = {
  black: '#1a1a1a',
  white: '#f5f5f5',
  natural: '#c8a477',
  brown: '#6b4a2e',
  gold: '#c9a646',
  silver: '#b8b8b8',
  'dark grey': '#4a4a4a',
  'light grey': '#cfcfcf',
};
const countryName = (code) => {
  try {
    return COUNTRIES[code] || new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
  } catch {
    return code;
  }
};

/** Inline styles: the published CSS only ships `pn:` utilities. */
const styles = {
  panel: { display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: 500, opacity: 0.75 },
  spec: { fontSize: 13, margin: 0, lineHeight: 1.5 },
  select: { width: '100%', padding: '6px 8px', fontSize: 13, marginTop: 4 },
  swatches: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  swatch: (color, active) => ({
    width: 26,
    height: 26,
    background: color,
    border: active ? '2px solid #2563eb' : '1px solid #d4d4d4',
    outline: active ? '2px solid #fff' : 'none',
    outlineOffset: -4,
    cursor: 'pointer',
    padding: 0,
  }),
  hint: { fontSize: 12, lineHeight: 1.45, opacity: 0.65, margin: 0 },
  progress: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '10px 12px', background: '#f4f4f4' },
  error: { fontSize: 13, color: '#b42318', margin: 0 },
  dialog: { maxWidth: 820, width: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' },
  verdict: (ok) => ({
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 600,
    background: ok ? '#e8f5e9' : '#fff4e5',
    color: ok ? '#1b5e20' : '#8a4b00',
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 },
  th: { textAlign: 'left', fontWeight: 500, opacity: 0.7, padding: '6px 8px', borderBottom: '1px solid #e0e0e0' },
  td: { padding: '6px 8px', borderBottom: '1px solid #f0f0f0' },
  chosen: { background: '#fff8e1' },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.5,
    margin: '6px 0 0',
    padding: 12,
    background: '#f4f4f4',
    overflowX: 'auto',
    whiteSpace: 'pre',
    maxHeight: 280,
  },
};

const money = (value, currency = 'EUR') =>
  Number.isFinite(value) ? new Intl.NumberFormat('en', { style: 'currency', currency }).format(value) : '–';
const show = (value) =>
  JSON.stringify(value, (k, v) => (typeof v === 'string' && v.length > 100 ? `${v.slice(0, 60)}…` : v), 2);

function Result({ result, onClose }) {
  const chosen = result.quotes.find((q) => q.country === result.country);
  const downloaded = result.order.details?.downloadAssets === 'Complete';
  const issues = result.order.issues || [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={styles.dialog}>
        <DialogHeader>
          <DialogTitle>Back from Prodigi</DialogTitle>
          <DialogDescription>
            Prodigi&apos;s sandbox quoted the print this editor just exported for buyers in four countries, then took
            order {result.order.id} for the {result.product.color} frame and checked the file. Sandbox orders are never
            printed{result.order.cancelled ? ', and this one was cancelled' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div style={styles.verdict(downloaded && !issues.length)}>
          {downloaded && !issues.length
            ? `Prodigi downloaded the print file and accepted it. A buyer in ${chosen?.city} gets it from the ${countryName(chosen?.printedIn)} lab.`
            : issues.length
              ? `Prodigi flagged the file: ${issues.map((i) => i.description || i.errorCode).join('; ')}`
              : `Prodigi took the order. File check: ${result.order.details?.downloadAssets || 'pending'}.`}
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Buyer in</th>
              <th style={styles.th}>Printed in</th>
              <th style={styles.th}>Framed print</th>
              <th style={styles.th}>Shipping</th>
            </tr>
          </thead>
          <tbody>
            {result.quotes.map((q) => (
              <tr key={q.country} style={q.country === result.country ? styles.chosen : undefined}>
                <td style={styles.td}>{q.city}</td>
                <td style={styles.td}>{q.printedIn ? countryName(q.printedIn) : '–'}</td>
                <td style={styles.td}>{money(q.price, q.currency)}</td>
                <td style={styles.td}>{money(q.shipping, q.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.requests.map((r) => (
          <div key={r.endpoint} style={{ marginTop: 18 }}>
            <span style={styles.label}>{r.title}</span>
            <pre style={styles.code}>{`${r.endpoint}\n${show(r.body)}\n\n→ ${show(r.response)}`}</pre>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function prodigiSection(product) {
  const Panel = ({ store }) => {
    const [color, setColor] = React.useState('black');
    const [country, setCountry] = React.useState('GB');
    const [step, setStep] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [result, setResult] = React.useState(null);

    const send = async () => {
      setError(null);
      setStep('Exporting the print file…');
      try {
        store.selectElements([]);
        // The canvas is Prodigi's exact print size, so pixelRatio 1 is the file.
        const png = await store.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
        setStep('Prodigi is quoting and checking the file…');
        const res = await fetch(`${API}/prodigi/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ png, color, country }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Prodigi request failed');
        setResult(json);
      } catch (e) {
        console.error('prodigi order failed', e);
        setError(e?.message || 'Something went wrong');
      } finally {
        setStep(null);
      }
    };

    return (
      <div style={styles.panel}>
        <div>
          <span style={styles.label}>Product</span>
          <p style={styles.spec}>
            Classic framed fine art print, {product.widthCm} × {product.heightCm} cm, print file {product.widthPx} ×{' '}
            {product.heightPx} px
          </p>
        </div>
        <div>
          <span style={styles.label}>Frame: {color}</span>
          <div style={styles.swatches}>
            {Object.entries(FRAMES).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={`${name} frame`}
                aria-pressed={color === name}
                style={styles.swatch(hex, color === name)}
                onClick={() => setColor(name)}
                disabled={!!step}
              />
            ))}
          </div>
        </div>
        <label>
          <span style={styles.label}>Ship to</span>
          <select style={styles.select} value={country} onChange={(e) => setCountry(e.target.value)} disabled={!!step}>
            {Object.entries(COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={step ? undefined : send} aria-busy={!!step}>
          {step ? 'Asking Prodigi…' : 'Send to Prodigi'}
        </Button>
        {step && (
          <div role="status" style={styles.progress}>
            <Spinner />
            {step}
          </div>
        )}
        {error && <p style={styles.error}>{error}</p>}
        <p style={styles.hint}>
          Exports the print at Prodigi&apos;s exact pixel size and sends it to Prodigi&apos;s sandbox API, which quotes
          it, picks a lab and checks the file. Sandbox orders are never printed.
        </p>
        {result && <Result result={result} onClose={() => setResult(null)} />}
      </div>
    );
  };

  return {
    name: 'prodigi',
    Tab: (props) => (
      <SectionTab name="Prodigi" {...props}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="2.5" width="14" height="15" stroke="currentColor" strokeWidth="1.4" />
          <rect x="6" y="5.5" width="8" height="9" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </SectionTab>
    ),
    Panel,
  };
}
