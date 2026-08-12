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

**5. Test it**
```bash
curl -X POST https://your-project.vercel.app/api/check-link \
  -H "Content-Type: application/json" \
  -d '{"link":"https://www.google.com"}'
```
Expect `{"status":"safe","details":"..."}`. Google publishes a safe
test URL for the malware list to see the "danger" path too:
`http://testsafebrowsing.appspot.com/s/malware.html`.

**Local development:** `vercel dev` reads `.env` (copy `.env.example`
→ `.env` and fill in your key) so you can test against `localhost`
before deploying.

**Test suite:** `test.mjs` exercises the handler's logic end-to-end
(method/input validation, safe/danger parsing, redirect resolution,
the SSRF guard, and error fallbacks) against a mocked `fetch`, so it
runs offline with no API key or network needed:
```bash
node test.mjs
```
Worth re-running after any change to `check-link.js`.

## Part C — Wire up the Expo frontend

File: `LinkCheckerScreen.js`

**1. Install the clipboard package**
```bash
npx expo install expo-clipboard
```

**2. Point it at your backend**
Easiest: set an env var so you're not hardcoding URLs per environment.
Create/edit `.env` at your Expo project root:
```
EXPO_PUBLIC_API_URL=https://your-project.vercel.app/api/check-link
```
(Expo inlines `EXPO_PUBLIC_*` vars at build time.) If you'd rather not
deal with env vars, just edit the `API_URL` fallback constant at the
top of `LinkCheckerScreen.js` directly.

**3. Drop the file into your project** and register it as a screen in
whatever navigator you're using, e.g. with React Navigation:
```js
import LinkCheckerScreen from './LinkCheckerScreen';
// <Stack.Screen name="LinkChecker" component={LinkCheckerScreen} />
```

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

- **SSRF guard is a literal-hostname check**, not a DNS-resolution
  check. It blocks `http://127.0.0.1/...` and similar written
  directly, but a determined attacker could in principle use DNS
  rebinding (a domain that resolves to a private IP) to get around
  it. Given Vercel functions run in an isolated, ephemeral
  environment with no access to other infrastructure, the blast
  radius of that gap is low — but if this ever handles anything more
  sensitive, resolve the hostname yourself with Node's
  `dns.promises.lookup()` and check the *resolved* IP before
  fetching, on every hop.
- **The endpoint is public**, protected by per-IP rate limiting and a
  shared-secret header (`x-app-secret`) rather than a full auth
  system — proportionate for this app's threat model, not a
  substitute for real authentication if the use case changes.
