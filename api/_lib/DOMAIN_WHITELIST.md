# Domain whitelist — provenance & update process

`domain-whitelist.js` in this directory is a manually-verified allowlist of
official Israeli domains (banks, health funds, insurers, telecoms, government
bodies, shipping/logistics, ...). It is consulted by `api/check-link.js`
*before* Google Web Risk is called — a domain on this list gets an immediate
`safe` verdict, with no wait on Web Risk at all. (Web Risk is still checked
for these domains, in the background, as a safety net — see "Safety net:
Web Risk still runs, just not in the critical path" below. It's just never
awaited before the user gets their answer.)

## Why this is worth having a separate, stronger fast path

These are exactly the domains phishing campaigns impersonate most (bank
logins, health-fund portals, government tax/benefits sites). A manually
verified exact match on one of them is a stronger, more specific signal than
a generic Web Risk "not on any known threat list" — and responding
immediately, without waiting on Web Risk's network round-trip, is a
meaningful latency win for the single most common case this app sees (a
real bank/gov/insurer link, not a phishing one).

## How it was built (last full pass: 2026-09-17)

Not scraped or generated from a keyword list. Built over several rounds:

1. An initial candidate list (~150 domains) grouped by category (banks,
   credit cards, health funds, insurers, telecom, shipping, government,
   transport, aviation, energy, retail).
2. **DNS resolution** checked for every domain (and, where the apex had no
   `A` record, its `www.` variant too).
3. Domains that failed DNS were individually re-investigated: web search
   for the organization's actual official domain, cross-checked against
   multiple independent sources, then re-verified by DNS resolution again.
   This caught several real mistakes in the original candidate list:
   typos (`amispgas.co.il` → `amisragas.co.il`), missing hyphens
   (`ramilevy.co.il` → `rami-levy.co.il`), wrong domains entirely
   (`direct.co.il` → `555.co.il` for ביטוח ישיר), and one outright
   mislabeling (`bth.co.il` is ביטוח חקלאי, not ביטוח ישיר as originally
   listed).
4. Domains confirmed to no longer have an independent presence (e.g. a bank
   that merged into another and ceased operating under its own domain) were
   **removed**, not flagged — an absent domain can't be typosquatted.
5. A few entries are deliberately `www.<domain>` rather than the bare apex,
   because the apex has no `A` record for that organization (confirmed
   during the audit) — e.g. `www.isa.gov.il`, `www.idf.il`,
   `www.iaa.gov.il`, `www.clalbit.co.il`. The bare apex is deliberately
   **not** included for these; see "Exact matching" below.

**What was *not* independently verified for every entry in this pass:**
live SSL certificate inspection and WHOIS/RDAP registration data — the
environment this audit ran in intercepts all outbound TLS (so a live SSL
check would report a locally-generated certificate, not the real one) and
blocks outbound WHOIS (port 43) entirely. DNS resolution plus corroborating
web research was used as the practical substitute. If you have access to an
unrestricted network, re-running the original `verify_domains.py`-style
checks (DNS + SSL + WHOIS) against this list is a reasonable periodic
sanity check, not a blocker to using it as-is.

## Exact matching, on purpose

Matching in `getWhitelistEntry()` is **exact on the full hostname**, no
implicit subdomain expansion in either direction:

- `www.isa.gov.il` (on the list) does **not** match a request for
  `isa.gov.il` (not on the list, and doesn't even resolve).
- `leumi.co.il` (on the list) does **not** match `online.leumi.co.il` or
  `leumi.co.il.evil.com` — if a real new subdomain needs whitelisting, add
  it as its own explicit entry.

This is deliberately stricter than the existing `KNOWN_SAFE_DOMAINS` list in
`check-link.js` (which does allow subdomain matching, e.g. any `*.gov.il`) —
that list only nudges the heuristic's score, while this one fully bypasses
Web Risk, so it needs a tighter guarantee.

## Safety net: Web Risk still runs, just not in the critical path

Earlier versions of this list skipped Web Risk *entirely* for a whitelisted
domain. That had a real gap: Web Risk would never get a chance to flag one
of these domains if it were ever compromised (e.g. a real bank's site
serving injected malware) or added to a threat list after the fact.

`backgroundVerifyWhitelistedDomain()` in `api/check-link.js` closes most of
that gap without giving up the latency win:

- The user-facing response is still immediate and never waits on Web
  Risk — `sendVerdict()` is called, and only *then* is the background
  check kicked off (fire-and-forget, via `waitUntil` from
  `@vercel/functions` so the check actually gets to finish instead of
  racing the function instance freezing).
- Web Risk is queried on the exact same `finalUrl` that would have been
  checked on the normal path.
- **It is sampled, not run on every request** (`WHITELIST_WEBRISK_SAMPLE_RATE`,
  default 10%) — see "Why sampled, not every request" below.
- If that background check comes back `danger`, there is **no retroactive
  fix**: the user already has their answer, and this architecture has no
  mechanism to reach back and change a response already sent. What it
  *does* do is log a high-severity, greppable line
  (`[WHITELIST SAFETY NET] ...`, via `console.error` — see "Where the
  warning goes" below) naming the domain, what Web Risk returned, and
  when. **This is a signal for a human to investigate and decide whether
  the entry needs to come out of the list — the code itself never removes
  anything automatically.** A false positive from Web Risk is possible;
  a domain that's actually been compromised needs a real incident
  response, not a silent auto-removal that a bot could potentially
  trigger by feeding Web Risk something misleading.

This list should still stay limited to registrable domains of real
organizations that are not attacker-controllable — never a URL shortener, a
redirect service, a UGC platform (forums, `blogspot.com`-style hosting), or
anything else where a bad actor could get a link approved on the
organization's own domain. The safety net reduces the cost of a mistake
here; it doesn't replace picking the right domains in the first place.

### Why sampled, not every request

Whitelisted domains are, almost by definition, the *highest-traffic
legitimate* links this app sees — a real bank/gov/insurer link gets pasted
into the checker far more often than a phishing one. Running the safety-net
check on every single one of those requests would roughly double this
project's Web Risk call volume, spent entirely on a check whose premise is
"this basically never finds anything." That's a meaningful, avoidable bite
out of the free-tier quota. Sampling a fraction of requests
(`WHITELIST_WEBRISK_SAMPLE_RATE`, default `0.1`) keeps steady statistical
coverage over time — a compromise that persists for any real length of time
will still get caught, just not necessarily on the very first request after
it starts — at a bounded, predictable cost. Tune it via that env var
without a code change; `1` (check every request) or `0` (disable the safety
net entirely) are both valid values if you want to trade cost for
detection speed differently.

This sampling decision is entirely separate from, and doesn't interact
with, the existing per-IP rate limiter (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW`
in `check-link.js`, backed by Upstash Redis) — that limiter protects
against one client hammering the public endpoint; this is an internal
decision about how often *our own* backend calls out to Web Risk for a
category of request that already got its answer.

### Where the warning goes

This project has no dedicated alerting/monitoring service wired in today —
no Sentry, no external webhook, nothing beyond Vercel's own log viewer. So
`console.error` with a distinctive, greppable prefix
(`[WHITELIST SAFETY NET]`) *is* the alerting mechanism right now: it lands
in Vercel's logs under the "Error" severity level, where it's filterable
and (if you set one up) can back a Vercel Log Drain or a simple "alert on
any Error-level log matching this prefix" rule. If this project ever adds
real monitoring (Sentry, a Slack/webhook alert, etc.), this is the exact
call site to also report to it — the log line already carries everything
needed (`domain`, `name`, `finalUrl`, `webRiskDetails`, `at`).

## How to add or remove a domain

1. Confirm DNS resolution (`dig +short <domain>` / `nslookup`), and ideally
   the `www.` variant too if the apex doesn't resolve.
2. Confirm the domain via an independent source (the organization's own
   published contact info, a well-established directory, etc.) — not just
   one search result.
3. Add the entry to `DOMAIN_WHITELIST` in `domain-whitelist.js` with an
   accurate `category` and `name`.
4. Add or update a test in `test.mjs` covering the new entry if it's a
   meaningfully new case (e.g. another apex-vs-`www.` situation).
5. This is a manual, reviewed process by design — there is no automatic
   ingestion. A wrong entry here is a direct "skip all fraud detection"
   bypass, so it should never be added without the checks above.
