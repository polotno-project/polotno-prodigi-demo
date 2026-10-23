# Prodigi API demo with Polotno

A 40 × 50 cm framed print editor built with Polotno SDK that sends the print file to the Prodigi Print API, shows which lab would print it in four countries, and places a sandbox order Prodigi checks the file for.

> **You need a Polotno API key to run this.** The code in this repo is MIT, but it runs on [Polotno SDK](https://polotno.com), which is commercial. Get a trial key in your [Polotno dashboard](https://polotno.com/cabinet) to try it (trial keys show a "Powered by Polotno" credit); shipping it in a product needs a [paid Polotno license](https://polotno.com/sdk/pricing).

Try it live: [polotno.com/sdk/product/integrations/prodigi](https://polotno.com/sdk/product/integrations/prodigi)

## How it works

1. The editor is sized to Prodigi's print spec, so the export matches what Prodigi expects.
2. Pressing the button in the **Prodigi** tab exports the print file and posts it to the server.
3. The server quotes the print per country, places a sandbox order with the hosted PNG, waits for Prodigi to download it and cancels the order.
4. The result shows what came back, plus the exact requests sent, ready to copy into your backend.

## Run it

You need Node 20+, pnpm, a Polotno API key (a trial key from [polotno.com/cabinet](https://polotno.com/cabinet) works for trying it) and Prodigi API credentials.

```bash
cd server
cp .env.example .env   # add your Prodigi credentials
node --env-file=.env server.mjs
```

```bash
cd web
cp .env.example .env   # add your Polotno key
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The credentials stay on the server.

Prodigi downloads the print file from this server, so to run it locally expose the server with a tunnel (for example `cloudflared tunnel --url http://localhost:8787`) and set `PUBLIC_URL` to the tunnel address.

## Where things are

- `web/src/index.jsx`: the editor, sized to the product
- `web/src/prodigi-section.jsx`: the Prodigi tab and the result dialog
- `server/server.mjs`: the Prodigi API calls

## More providers

The same pattern for other print APIs: [polotno-project on GitHub](https://github.com/polotno-project?q=demo) (Printful, Printify, Teemill, Fourthwall, Spreadconnect, Scalable Press, Lulu, Peecho, Gelato, Prodigi).

## License

The code in this repository is MIT. Polotno SDK itself is not: it needs a Polotno API key, and production use needs a [paid license](https://polotno.com/sdk/pricing).
