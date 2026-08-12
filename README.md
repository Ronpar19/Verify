# Verify — Phishing Link Checker

A mobile app + backend that lets everyday users paste a link (from an
SMS, email, or WhatsApp message) and get an instant, color-coded
safety verdict, without ever leaving the app or exposing them to the
link itself.

**[Live Demo (PWA)](https://verifyweb-phi.vercel.app)** · **[Android APK](https://verifyweb-phi.vercel.app/link-checker.apk)**

<!--
  SCREENSHOT / GIF PLACEHOLDER — replace this comment with a real image
  or short GIF before publishing, e.g.:
  ![Verify demo](./docs/demo.gif)
  Suggested capture: paste link → checking state → red/green/yellow result.
-->

## What it checks for, and how results are labeled

- 🟢 **No known threat detected** — not on any known threat list, and
  the link's own structure doesn't look suspicious.
- 🔴 **Likely dangerous** — confirmed by Google Web Risk, or a strong
  structural red flag (e.g. the `@`-trick, a raw IP address).
- 🟡 **Uncertain** — not yet catalogued as a known threat, but the
  link's structure raises some suspicion. Treated as "be careful,"
  not "safe."

(Deliberately not calling anything "guaranteed safe" — see *Why this
project is interesting* below for why.)

## What I built

- React Native (Expo) mobile client — PWA + Android APK
- Serverless Node.js backend on Vercel
- Google Web Risk API integration
- A custom structural heuristic layer (second opinion / fallback)
- Redirect resolution + SSRF protection
- Per-IP rate limiting and usage stats, backed by Upstash Redis
- 38/38 automated tests (backend logic + URL extraction), no live
  API calls required to run

## Why this project is interesting (the engineering decisions)

- **Secure server-side API key handling.** The Google API key lives
  only as a server-side environment variable on Vercel — never in
  the client bundle, so it can't be extracted by unpacking the app.
- **Two independent detection signals, not one.** Google Web Risk
  only knows about *already-catalogued* threats. A local structural
  heuristic (domain patterns, brand impersonation, suspicious TLDs)
  acts as a second opinion, and as the sole signal if Web Risk is
  ever unavailable.
- **SSRF-aware redirect resolution.** The backend resolves redirects
  itself (to catch shortened links) and refuses to follow one into a
  private/loopback/link-local address.
- **Rate limiting + fail-safe error handling.** The public endpoint
  is protected from abuse of the free API quota, and any failure in
  the chain degrades to a cautious "uncertain" result instead of
  crashing — the user is never left without an answer.

Two of these decisions are worth spelling out, because they came up
in actual product tradeoffs:

A **"safe" verdict from Web Risk still gets checked against the
heuristic before being trusted outright** — Web Risk is a list
lookup, not live content analysis, so a brand-new phishing link or a
freshly-compromised legitimate site won't be on it yet. Trusting it
blindly would give users false confidence.

**Web Risk, not Safe Browsing v4** — Safe Browsing is free but
explicitly forbids commercial use and is officially deprecated. Web
Risk is the supported, commercially-usable successor, chosen
deliberately for a project meant to be maintained long-term.

## Tech stack

| Layer      | Choice                                          |
|------------|--------------------------------------------------|
| Frontend   | React Native (Expo SDK 54), PWA + Android APK targets |
| Backend    | Node.js serverless functions on Vercel (Hobby/free tier) |
| Threat API | Google Web Risk API                             |
| Rate limiting / stats | Upstash Redis (free tier)            |
| Build      | EAS Build (free tier, internal distribution)     |
| Tests      | Custom test runner (`test.mjs`), mocked `fetch`, no live API calls |

## Architecture

```
[Expo app] --POST {link}--> [Vercel /api/check-link] --GET?key=...--> [Google Web Risk API]
                                     ^
                                     └─ also resolves shortened links (bit.ly, etc.)
                                        to their real destination first
```

Backend API (for reference, not meant for direct browsing):
`https://verifyapp-khaki.vercel.app/api/check-link`

## What the backend actually does (`api/check-link.js`)

1. Validates the request is `POST` with a non-empty `link` string.
2. Normalizes the URL and **resolves redirects** (up to 5 hops) so a
   shortened link gets checked at its *real* destination.
3. Refuses to follow a redirect into a private/loopback/link-local
   address (SSRF guard).
4. Calls Google Web Risk to check the URL against `MALWARE`,
   `SOCIAL_ENGINEERING`, and `UNWANTED_SOFTWARE` threat lists.
5. Cross-checks the result against a local structural heuristic
   before returning a final verdict.
6. Any failure anywhere in that chain degrades to a cautious
   `"unknown"` result with a `200` — the app never crashes or hangs.

## Security notes

- **SSRF guard is a literal-hostname check**, not a DNS-resolution
  check — a documented, accepted limitation given the low blast
  radius of an isolated, ephemeral serverless function. Resolving the
  hostname with `dns.promises.lookup()` and checking the *resolved*
  IP on every hop would close this gap if the threat model changes.
- **Rate limiting + shared secret** protect the public endpoint from
  casual abuse of the free Web Risk quota.

## Setup & deployment

The full step-by-step deployment guide (Google Cloud setup, Vercel
deployment, Expo wiring) lives in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## License

MIT — see [LICENSE](./LICENSE).
