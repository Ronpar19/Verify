# Verify — Phishing Link Checker

A mobile app + backend that lets everyday users paste a link (from an
SMS, email, or WhatsApp message) and get an instant, color-coded
safety verdict — green (safe), red (dangerous), or yellow (uncertain)
— without ever leaving the app or exposing them to the link itself.

Built end-to-end: React Native/Expo client, a Node.js serverless
backend on Vercel, Google Web Risk API integration, and a custom
heuristic layer that catches threats Web Risk hasn't catalogued yet.

**Live:**
- PWA: https://verifyweb-phi.vercel.app
- Backend API: https://verifyapp-khaki.vercel.app/api/check-link

---

## Why this project is interesting (the engineering decisions)

- **API key never touches the client.** The Google API key lives only
  as a server-side environment variable on Vercel. The mobile app
  never sees it, so it can't be extracted by unpacking the app bundle.
- **Web Risk, not Safe Browsing v4.** Safe Browsing is free but
  explicitly forbids commercial use and is officially deprecated.
  Web Risk is the supported, commercially-usable successor — a
  deliberate choice for a project meant to be maintained long-term.
- **Two independent signals, not one.** Web Risk only knows about
  *already-catalogued* threats. A local structural heuristic (domain
  patterns, the `@`-trick, raw IPs, suspicious TLDs, brand
  impersonation) acts as a second opinion — and as the sole signal if
  Web Risk is ever unavailable. A "safe" verdict from Web Risk still
  gets checked against the heuristic before being trusted outright.
- **Basic SSRF hardening.** The backend resolves redirects itself
  (to catch shortened links) and refuses to follow a redirect into a
  private/loopback/link-local address — with a documented limitation
  (literal-hostname check, not DNS-resolution) and a clear upgrade
  path if the threat model ever changes.
- **Fails safe, not silent.** Any failure in the chain (bad key,
  network error, malformed input) degrades to a cautious "uncertain"
  result instead of crashing or hanging — the user is never left
  without an answer.
- **API abuse protection.** The endpoint is rate-limited per IP and
  gated by a shared-secret header, so the free Google Web Risk quota
  can't be silently drained by a public, unauthenticated endpoint.
- **38/38 tests passing** (23 backend logic tests + 15 URL-extraction
  tests) run against a mocked `fetch`, so the suite runs offline with
  no API key or network needed.

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

## What the backend actually does (`api/check-link.js`)

1. Validates the request is `POST` with a non-empty `link` string.
2. Normalizes the URL and **resolves redirects** (up to 5 hops) so a
   shortened link gets checked at its *real* destination.
3. Refuses to follow a redirect into a private/loopback/link-local
   address (SSRF guard).
4. Calls Google Web Risk to check the URL against `MALWARE`,
   `SOCIAL_ENGINEERING`, and `UNWANTED_SOFTWARE` threat lists.
5. Cross-checks the result against a local structural heuristic
   before returning a final verdict of `safe`, `danger`, or
   `uncertain`.
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
