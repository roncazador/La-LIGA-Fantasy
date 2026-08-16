# LALIGA Fantasy Manager · roncazador · v2.0.1

Deployable repository layout for GitHub + Render from an iPhone.

All files intentionally live at repository root:
- `server.mjs` — Node backend + static frontend server
- `package.json` — Node configuration
- `index.html` — Fantasy Manager PWA
- `manifest.json`, `sw.js` — PWA support
- `.env.example` — environment variable template
- `test.mjs` — read-only policy test

## Render
- Runtime: Node
- Root Directory: leave empty
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Do not commit secrets. The backend has no write routes for purchases, sales, bids, clauses, blindajes or lineup changes.

OAuth is intentionally left unconfigured until the HTTPS Render URL is known. Then the official redirect URI can be set to:
`https://YOUR-SERVICE.onrender.com/auth/callback`
only if the provider/client registration accepts that redirect.
