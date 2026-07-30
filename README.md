# Link Checker — Google Web Risk backend

Architecture: **Expo app → your Vercel API → Google Web Risk API**. The
Google API key lives only on Vercel, as an environment variable — it is
never bundled into the mobile app or sent to the client.

```
[Expo app] --POST {link}--> [Vercel /api/check-link] --GET?key=...--> [Google Web Risk API]
                                     ^
                                     └─ also resolves shortened links (bit.ly, etc.)
                                        to their real destination first
```

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
100%). You'll get an email if spend ever crosses that line.

**Read this part carefully — it corrects something in the original ask:**
a Google Cloud budget is a *notification*, not a spending cap. Google's
own docs are explicit about this: "Setting a budget does not automatically
cap Google Cloud usage or spending. Budgets trigger alerts to inform you
of how your usage costs are trending over time." There is no built-in
"never charge me" switch for a single API.

Two things make this a non-issue in practice for an app like this:
- The Web Risk **Lookup API is free for the first 100,000 calls/month** —
  that's over 3,000 checks a day before a single cent is charged. Past
  that, it's $0.50 per 1,000 calls.
- Because the key only lives on Vercel (never in the app bundle), the
  realistic ways spend would spike are a leaked key or a hammered public
  endpoint — see "Optional hardening" below for both.

If you want a true hard stop (not just an alert) on top of that: Google
documents a pattern where a budget alert publishes to Pub/Sub, which
triggers a Cloud Function that calls the Cloud Billing API to disable
billing on the project entirely. It works, but it's a bigger lift (a
second deployed function + IAM permissions) and it's a blunt instrument —
disabling billing shuts down *every* service in the project, not just Web
Risk, and there's reporting lag so a few extra calls can land after it
fires. Google's walkthrough is here:
https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
For a project this size, a low-threshold email alert plus the key
restriction above is the proportionate choice; treat the auto-disable
route as optional.

---

## Part B — Deploy the backend to Vercel

Files in this delivery:
```
link-checker-vercel/
├── api/
│   └── check-link.js
├── package.json
├── .env.example
└── .gitignore
```

**1. Install the Vercel CLI (if you don't have it)**
```bash
npm install -g vercel
```

**2. Log in and deploy**
From inside the `link-checker-vercel` folder:
```bash
vercel
```
Follow the prompts (link to a new or existing Vercel project). This
creates a preview deployment first — that's expected.

**3. Add the environment variable**
Either via the dashboard: **Project → Settings → Environment Variables**
→ add `GOOGLE_API_KEY` with the key from Part A, for all environments
(Production/Preview/Development) → **Save**.

Or via the CLI:
```bash
vercel env add GOOGLE_API_KEY
```

**4. Deploy to production**
```bash
vercel --prod
```
Note the production URL it gives you, e.g. `https://your-project.vercel.app`.
Your endpoint is `https://your-project.vercel.app/api/check-link`.

**5. Test it**
```bash
curl -X POST https://your-project.vercel.app/api/check-link \
  -H "Content-Type: application/json" \
  -d '{"link":"https://www.google.com","lang":"he"}'
```
Expect `{"status":"safe","details":"..."}`. `lang` is optional — omit it
(or send an unsupported code) and it falls back to Hebrew. Google
publishes a safe test URL for the malware list if you want to see the
"danger" path too: `http://testsafebrowsing.appspot.com/s/malware.html`.

**Local development:** `vercel dev` reads `.env` (copy `.env.example` →
`.env` and fill in your key) so you can test against `localhost` before
deploying.

**Included test suite:** `test.mjs` exercises the handler's logic
end-to-end (method/input validation, safe/danger parsing, redirect
resolution, the SSRF guard, error fallbacks, and the `lang` parameter —
including its Hebrew default when `lang` is missing or unsupported)
against a mocked `fetch`, so it runs offline with no API key or network
needed:
```bash
node test.mjs
```
Worth re-running after any change to `check-link.js`.

---

## Part C — Wire up the Expo frontend

Files: `LinkCheckerScreen.js`, `translations.js`, `extractUrls.js`.

**1. Install the required packages**
```bash
npx expo install expo-clipboard expo-localization
```
`expo-clipboard` powers the "auto-paste" button; `expo-localization`
detects the device's language so the app can default to it.

**2. Point it at your backend**
Easiest: set an env var so you're not hardcoding URLs per environment.
Create/edit `.env` at your Expo project root:
```
EXPO_PUBLIC_API_URL=https://your-project.vercel.app/api/check-link
```
(Expo inlines `EXPO_PUBLIC_*` vars at build time.) If you'd rather not
deal with env vars, just edit the `API_URL` fallback constant at the top
of `LinkCheckerScreen.js` directly.

**3. Drop all three files into your project** (`LinkCheckerScreen.js`,
`translations.js`, and `extractUrls.js` must sit in the same folder,
since the screen imports the other two) and register the screen in
whatever navigator you're using, e.g. with React Navigation:
```js
import LinkCheckerScreen from './LinkCheckerScreen';
// <Stack.Screen name="LinkChecker" component={LinkCheckerScreen} />
```

**Languages:** the app supports Hebrew, English, Russian, French, and
Arabic. It defaults to whatever language the device is set to; if the
device's language isn't one of those five, it falls back to Hebrew. A
small 🌐 button in the top-right corner opens a popover so the user can
override this manually at any time — the choice isn't persisted between
app restarts (resets to the device default each launch) unless you add
your own storage for it.

**Multiple links in one message:** if the pasted text contains more than
one link, all of them are checked one after another (not in parallel).
The overall banner escalates to "danger" the moment any single link comes
back dangerous, even while the rest are still being checked, and a list
below shows the individual result (and, for anything not safe, the short
reason) for each link found.

**One carry-over note from the web prototype:** there's no API on either
iOS or Android for a normal app to silently read the last SMS for
arbitrary content — that's deliberately locked down for privacy (the OTP
autofill you're picturing is a narrow, purpose-built exception with its
own strict format, not a general SMS reader). "הדבקה אוטומטית" is wired
to the clipboard instead (`expo-clipboard`), which will work reliably
here since it's a real native API — not the browser-sandbox situation
from the earlier HTML version. The user copies the link first (long-press
→ Copy in Messages/Mail), then taps the button.

---

## What the backend actually does (`api/check-link.js`)

1. Validates the request is `POST` with a non-empty `link` string. An
   optional `lang` field (`he`/`en`/`ru`/`fr`/`ar`) controls the language
   of every message returned; missing or unsupported values default to
   Hebrew.
2. Normalizes the URL (adds `http://` if no scheme was given).
3. **Resolves redirects** (HEAD requests, up to 5 hops, falling back to
   GET if a server rejects HEAD) so a `bit.ly/xyz` link gets checked at
   its *real* destination, not at bit.ly's own domain.
4. Refuses to follow a redirect into a private/loopback/link-local
   address (basic SSRF guard — see limitation below).
5. Calls `GET https://webrisk.googleapis.com/v1/uris:search` with
   `threatTypes=MALWARE`, `SOCIAL_ENGINEERING`, and `UNWANTED_SOFTWARE`,
   authenticated via `key=` (your env var, never touched by the client).
6. Google returns an **empty object** if the URL isn't on any list (=
   safe) or a `threat` object naming the matched list(s) (= danger).
   If Web Risk hasn't seen the link yet, the heuristic gets a say: a
   handful of patterns with essentially no legitimate use on the modern
   web — the userinfo `user@host` trick, or a raw IP address standing in
   for a domain — escalate straight to `danger` even without Web Risk's
   confirmation. Weaker, more error-prone combinations (plain `http` + a
   cheap TLD + a word like "login") do NOT get this treatment and only
   ever reach `uncertain`, since those alone are common on legitimate
   small or older sites too.
7. Any failure anywhere in that chain (bad key, network error, Google API
   error, malformed input) is caught and returned to the client as
   `{"status":"unknown", ...}` with `200` — the app should never crash or
   hang because of a backend-side error, it should just show the cautious
   yellow state.

The frontend calls this endpoint once per link found in the pasted text
(sequentially, when there's more than one), so multi-link messages need
no backend changes at all — the "one after another, escalate on danger"
behavior lives entirely in `LinkCheckerScreen.js`.

## Security notes (read before shipping)

- **SSRF guard is a literal-hostname check**, not a DNS-resolution check.
  It blocks `http://127.0.0.1/...` and similar written directly, but a
  determined attacker could in principle use DNS rebinding (a domain that
  resolves to a private IP) to get around it. Given Vercel functions run
  in an isolated, ephemeral environment with no access to your other
  infrastructure, the blast radius of that gap is low — but if this ever
  handles anything more sensitive, resolve the hostname yourself with
  Node's `dns.promises.lookup()` and check the *resolved* IP before
  fetching, on every hop.
- **CORS is wide open (`Access-Control-Allow-Origin: *`)**, on purpose:
  the endpoint is already public and unauthenticated (see above), and a
  browser-based client — the web/PWA build — needs this to call the
  backend at all, since it runs on a different origin than the API. The
  mobile app (Expo Go, or an installed native/EAS build) ignores this
  header entirely; CORS is a browser-only mechanism, so this line changes
  nothing for it. If you add real auth later, tighten this to the web
  app's actual origin instead of `*`.
- **The endpoint is public and unauthenticated** by design (your Expo app
  has no login system implied here). That means anyone who finds the URL
  could call it directly. Realistic impact is small given the 100k free
  Web Risk calls/month, but if you want to close it off: the simplest
  option is a shared-secret header the Expo app sends and the function
  checks (`x-app-secret`, stored as another Vercel env var) — that stops
  casual abuse, not a determined attacker with the app's bundle in hand,
  but it's proportionate here. A stronger option is per-IP rate limiting
  via Vercel's Edge Config or a service like Upstash Redis. Neither is
  implemented above since you didn't ask for auth — flagging it as the
  natural next step for a public production endpoint, and more worth
  doing now that the app checks several links per message (more calls per
  paste than before).
