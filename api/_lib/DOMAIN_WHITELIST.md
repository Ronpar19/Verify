# Domain whitelist — provenance & update process

`domain-whitelist.js` in this directory is a manually-verified allowlist of
official Israeli domains (banks, health funds, insurers, telecoms, government
bodies, shipping/logistics, ...). It is consulted by `api/check-link.js`
*before* Google Web Risk is called — a domain on this list gets an immediate
`safe` verdict, and Web Risk is not queried at all for that request.

## Why this is worth having a separate, stronger fast path

These are exactly the domains phishing campaigns impersonate most (bank
logins, health-fund portals, government tax/benefits sites). A manually
verified exact match on one of them is a stronger, more specific signal than
a generic Web Risk "not on any known threat list" — and it also saves the
Web Risk API call entirely (relevant given the free-tier quota).

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

## The tradeoff this creates — read before adding a domain

Skipping Web Risk entirely for a whitelisted domain means Web Risk never
gets a chance to flag that domain if it were ever compromised (e.g. a real
bank's site serving injected malware) or added to a threat list after the
fact. This list should stay limited to registrable domains of real
organizations that are not attacker-controllable — never a URL shortener,
a redirect service, a UGC platform (forums, `blogspot.com`-style hosting),
or anything else where a bad actor could get a link approved on the
organization's own domain.

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
