# Deployment Guide

Full, step-by-step guide used to deploy this project from scratch —
Google Cloud setup, Vercel deployment, and wiring up the Expo
frontend. This is the practical runbook; for the architecture and
"why" behind these choices, see [`README.md`](./README.md).

---

## Part A — Google Cloud: get an API key

**1. Create or select a project**
Go to [console.cloud.google.com](https://console.cloud.google.com), and
create a new project (or pick an existing one) from the project dropdown
at the top of the page.

**2. Enable billing on the project**
Web Risk requires a billing account linked to the project — the API
returns a 403 error without one, *even for calls inside the free tier*.
Go to **Billing** in the left menu and link a billing account (or create
one). See the cost section below before doing this — the free tier is
generous, but billing must technically be "on."

**3. Enable the Web Risk API**
Go to **APIs & Services → Library**, search for **Web Risk API**, and
click **Enable**.

**4. Create an API key**
Go to **APIs & Services → Credentials → Create Credentials → API key**.
Copy the key — you'll paste it into Vercel in Part B.

**5. Restrict the key (important)**
Click into the new key's settings and, under **API restrictions**, choose
**Restrict key** and select only **Web Risk API**. This means even if the
key ever leaked, it couldn't be used to run up charges on any other
Google API.

**6. Set a budget alert**
Go to **Billing → Budgets & alerts → Create budget**. Scope it to this
project, set an amount (e.g. $5), and add threshold alerts (e.g. 50%,
100%).

A Google Cloud budget is a *notification*, not a spending cap — there's
no built-in "never charge me" switch for a single API. In practice this
is a non-issue here: the Web Risk **Lookup API is free for the first
100,000 calls/month** (over 3,000 checks a day), and the key only lives
server-side, so realistic overspend scenarios are limited to a leaked
key or a hammered public endpoint — both mitigated in this project via
key restriction and API-level rate limiting.

If you want a true hard stop (not just an alert) on top of that: Google
documents a pattern where a budget alert publishes to Pub/Sub, which
triggers a Cloud Function that calls the Cloud Billing API to disable
billing on the project entirely. It works, but it's a bigger lift and a
blunt instrument — disabling billing shuts down *every* service in the
project, not just Web Risk. For a project this size, a low-threshold
email alert plus the key restriction above is the proportionate choice.

## Part B — Deploy the backend to Vercel

```
link-checker-vercel/
├── api/
│   └── check-link.js
├── package.json
├── .env.example
└── .gitignore
```

**1. Install the Vercel CLI**
```bash
npm install -g vercel
```

**2. Log in and deploy**
```bash
vercel
```
This creates a preview deployment first — that's expected.

**3. Add the environment variable**
Either via the dashboard (**Project → Settings → Environment
Variables** → add `GOOGLE_API_KEY`), or via the CLI:
```bash
vercel env add GOOGLE_API_KEY
```

**4. Deploy to production**
```bash
vercel --prod
```
Note the production URL, e.g. `https://your-project.vercel.app`.
Your endpoint is `https://your-project.vercel.app/api/check-link`.

**5. Test it — the post-deploy smoke test**

Run this after **every** production deploy. It is the only check that
talks to the real Google Web Risk; the offline suites mock it.
```bash
SMOKE_API_URL=https://your-project.vercel.app/api/check-link \
SMOKE_APP_SECRET=<the APP_SECRET value, if you set one> \
npm run smoke
```
It sends Google's official, harmless test URL
(`http://testsafebrowsing.appspot.com/s/malware.html`) and fails unless
the answer is `danger`, carries `"webRisk": "ok"`, and has no "Basic
check only" text. Then it sends `https://www.google.com/` and expects
`safe`. It uses 2 Web Risk lookups and 2 requests of the rate limit.

**Checking by hand** (same thing, with curl):
```bash
curl -s -X POST https://your-project.vercel.app/api/check-link \
  -H "Content-Type: application/json" -H "x-app-secret: <APP_SECRET>" \
  -d '{"link":"http://testsafebrowsing.appspot.com/s/malware.html","lang":"en"}'
```
| You get | Meaning |
|---|---|
| `"status":"danger"`, `"webRisk":"ok"` | Working. |
| `"webRisk":"unavailable"`, text starts with "(Basic check only" | Web Risk is not answering — see the table below. |
| HTTP 401 | Wrong or missing `x-app-secret`. |
| HTTP 429 | Rate limited; wait an hour or test from another network. |

**If Web Risk is unavailable.** While it is, the app never answers
"safe": a link with nothing suspicious comes back "uncertain", because
the structural check alone cannot vouch for a link. To find the cause,
open Vercel → the backend project → **Logs**, search for
`check-link error (webrisk)`, and read the line:

| Log line | Fix |
|---|---|
| `GOOGLE_API_KEY is not set in the environment` | Vercel → Settings → Environment Variables: add it for **Production** (not only Preview), then redeploy — env changes only apply to new deployments. |
| `HTTP 400 INVALID_ARGUMENT API_KEY_INVALID` | The value is not a valid key (typo, extra space, a deleted key). |
| `HTTP 403 PERMISSION_DENIED SERVICE_DISABLED` | Google Cloud → APIs & Services → enable **Web Risk API** on the key's project. |
| `HTTP 403 PERMISSION_DENIED BILLING_DISABLED` | Link a billing account to that project (required even inside the free tier). |
| `HTTP 403 PERMISSION_DENIED API_KEY_SERVICE_BLOCKED` | The key's **API restrictions** don't include Web Risk API. |
| `HTTP 403 PERMISSION_DENIED API_KEY_HTTP_REFERRER_BLOCKED` / `API_KEY_IP_ADDRESS_BLOCKED` | The key's **Application restrictions** must be **None** — Vercel calls from changing server IPs with no referrer. |
| `HTTP 429 RESOURCE_EXHAUSTED` | Quota used up; see `/api/stats` below. |
| `TimeoutError` / `AbortError` / `TypeError` | Google didn't answer within 6 s (transient network problem). |

The log line never contains the API key or the link that was checked.

**Watching the quota.** `GET /api/stats?secret=<STATS_SECRET>` now
includes a `webRisk` block for the current month: `calls` (lookups sent
to Google, against `freeMonthlyCalls`) and `checksWithoutWebRisk` (how
many checks got no usable Web Risk answer). The second number should
stay at 0; if it grows, run the smoke test.

**Local development:** `vercel dev` reads `.env` (copy `.env.example`
→ `.env` and fill in your key) so you can test against `localhost`
before deploying.

**Test suites:** `test.mjs` exercises the handler's logic end-to-end
(method/input validation, safe/danger parsing, redirect resolution,
the connect-time SSRF guard on every hop, the redirect-chain time
budget, and error fallbacks) against mocked network/DNS/RDAP, so it
runs offline with no API key or network needed. Two smaller suites
cover the app:
```bash
npm test                 # backend (node test.mjs), from repo root
npm run test:mobile      # URL extraction + translations
```
Worth re-running all of them before every deploy.

## Part C — Set up the Expo frontend

`mobile/` is a complete, already-built Expo app — this section is
about running *it*, not about integrating a screen into a different
project. `LinkCheckerScreen.js` is the main screen, but it now pulls
in several sibling files (`translations.js`, `extractUrls.js`,
`terms.js`, `icons.js`, `statusIcons.js`) and isn't meant to be lifted
out on its own.

**1. Install dependencies**
```bash
cd mobile
npm install
```
`postinstall` runs `patch-package` automatically (a small, already-
committed native patch under `mobile/patches/`) — nothing extra to do
for that.

**2. Point it at your backend**
Create `mobile/.env` with the two variables the app actually reads
(`mobile/LinkCheckerScreen.js`):
```
EXPO_PUBLIC_API_URL=https://your-project.vercel.app/api/check-link
EXPO_PUBLIC_APP_SECRET=
```
`EXPO_PUBLIC_API_URL` is required. `EXPO_PUBLIC_APP_SECRET` is
optional — only set it if you also set `APP_SECRET` on the backend
(Part B); leave it blank otherwise, both sides treat "unset" as "skip
the check." Expo inlines `EXPO_PUBLIC_*` vars into the client bundle
at build time, so this value is extractable by anyone who unpacks the
app — that's expected here, it's meant to stop casual abuse of a
bare, discovered endpoint URL, not a determined attacker.

**3. Run it**
```bash
npm start     # interactive target picker
npm run web   # or android / ios directly
```
These map straight to `expo start`/`expo start --web`/etc. — see
`mobile/package.json` if you want the exact commands.

**Running the backend locally while you work on the frontend:**
instead of pointing `EXPO_PUBLIC_API_URL` at a deployed Vercel
project for every change, run the backend on your own machine with
the repo's own dev server:
```bash
node dev-server.mjs
```
from the repo root — no Vercel login or project linking needed (that's
its whole purpose; see the comment at the top of the file). It serves
`api/check-link.js` at `http://localhost:3000/api/check-link` and
already sends the CORS header the Expo web preview needs to reach it
from a different port. Point `EXPO_PUBLIC_API_URL` there while
developing, and switch it back to your deployed URL before shipping.
(`vercel dev` from Part B works too, if you'd rather run the real
Vercel runtime locally — by this point in the guide you're already
logged in, so it's mainly a question of convenience.)

**One carry-over note from the web prototype:** there's no API on
either iOS or Android for a normal app to silently read the last SMS
for arbitrary content — that's deliberately locked down for privacy
(the OTP autofill you're picturing is a narrow, purpose-built
exception with its own strict format, not a general SMS reader). Link
pasting is wired to the clipboard instead (`expo-clipboard`), which
works reliably as a real native API. The user copies the link first
(long-press → Copy in Messages/Mail), then taps the button.

## Environment variables reference

| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | Vercel (server) | Auth for Web Risk API calls |
| `APP_SECRET` | Vercel (server) + Expo `.env` (`EXPO_PUBLIC_APP_SECRET`) | Shared-secret header to reduce casual abuse of the public endpoint |
| `STATS_SECRET` | Vercel (server) | Protects the internal `/api/stats` endpoint |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Vercel (server) | Backing store for rate limiting and usage counters |
| `EXPO_PUBLIC_API_URL` | Expo `.env` | Points the app at the deployed backend |

## Security notes (read before shipping)

- **SSRF guard checks the resolved IP at connect time, on every
  hop.** Redirects are followed over `node:http`/`node:https` with a
  custom DNS `lookup`: every address returned for the host must be
  public unicast, or the connection is refused before a socket opens.
  Because the check and the connection share one resolution, DNS
  rebinding can't bypass it. Private IPs written literally into a
  link (in any notation, IPv4 or IPv6) are rejected before that. If
  you change the redirect code, keep the `lookup` hook — swapping
  back to `fetch()` would silently reopen the rebinding gap.
- **The endpoint is public**, protected by per-IP rate limiting and a
  shared-secret header (`x-app-secret`) rather than a full auth
  system — proportionate for this app's threat model, not a
  substitute for real authentication if the use case changes.
