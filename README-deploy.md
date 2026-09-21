# Deploying the RIM-HSE certificate verification Worker

This is a small server-side function that looks up one certificate at a
time and returns only that record — it replaces shipping the entire
certificate database to every visitor.

You need a free Cloudflare account. No credit card required for this.

## Option A — Dashboard only (no command line, ~5 minutes)

1. Go to https://dash.cloudflare.com → sign up / log in.
2. In the left sidebar: **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, e.g. `rim-hse-verify`. Click **Deploy** (it deploys a
   placeholder first — that's fine).
4. Click **Edit code**. Delete everything in the editor and paste in the
   full contents of `worker.js` from this folder.
5. Click **Deploy**.
6. You'll now have a URL like:
   `https://rim-hse-verify.<your-subdomain>.workers.dev`
   Copy it — you'll need it in step 8 below.
7. **Set your allowed origins:** in the pasted code, find the
   `ALLOWED_ORIGINS` array near the top and make sure it lists your real
   domain(s) exactly (e.g. `https://rim-hse.com` and
   `https://www.rim-hse.com`). Re-deploy after any edit.
8. **Point the website at the Worker:** open `index.html`, find this line
   near the top of the `<script>` block:
   ```js
   const VERIFY_API = "https://rim-hse-verify.YOUR-SUBDOMAIN.workers.dev/verify";
   ```
   Replace it with your actual Worker URL + `/verify`, e.g.:
   ```js
   const VERIFY_API = "https://rim-hse-verify.ely-chemad.workers.dev/verify";
   ```
9. Also update the CSP meta tag in `index.html`'s `<head>` — the
   `connect-src` value must include your Worker's origin, e.g.:
   ```html
   connect-src 'self' https://rim-hse-verify.ely-chemad.workers.dev;
   ```
10. Commit and push `index.html` to GitHub as usual.

That's it — the site now calls your Worker instead of carrying the full
dataset.

## Option B — Command line (wrangler), if you're comfortable with a terminal

```bash
npm install -g wrangler
cd rim-hse-verify-worker
wrangler login
wrangler deploy
```

This uses `wrangler.toml` already in this folder. Wrangler will print the
`workers.dev` URL when it's done — use that in steps 8–9 above.

## Updating the certificate list later

Whenever you add/renew/revoke certificates:

1. Update the `CERTS` array near the top of `worker.js` (same shape as
   before: `no`, `key`, `holder`, `company`, `type`, `category`,
   `issue`, `expiry`).
   - `key` is the normalised certificate number: uppercase, digits and
     letters only, no slashes/spaces. This is what gets matched.
2. Re-deploy: paste the updated file into the dashboard editor and click
   Deploy (Option A), or run `wrangler deploy` again (Option B).

Your site's `index.html` doesn't need to change for data updates — only
the Worker does. If you'd rather not hand-edit a JS array every time,
the natural next step is moving this data into Cloudflare KV or D1
(a small database) instead of hard-coding it in the script — happy to
set that up if this becomes frequent.

## Optional hardening

- **Rate limiting:** Cloudflare's dashboard (Security → WAF → Rate
  limiting rules) lets you cap requests per IP to `/verify` for free on
  a low tier. Worth adding once the site is live, to slow down anyone
  trying to enumerate certificate numbers by brute force.
- **Custom domain for the API:** instead of the `workers.dev` URL, you
  can route a subdomain like `api.rim-hse.com/verify` to this Worker if
  you move your domain's DNS to Cloudflare. Not required to function.
