# Accuracy evaluation

`npm run eval` (or `node eval/run.mjs`) runs every labelled link in
`eval/data/` through the real handler with the network mocked, and prints
how often the app is right. No live calls; it needs no API key.

| Flag | Effect |
|---|---|
| `--misses` | Also list every wrong answer, with the reason shown to the user. |
| `--json` | Machine-readable result. |
| `--no-gate` | Measure only; never fail. |

## What is measured

- **Legitimate links** (`data/legit.mjs`). Each should be answered
  "safe". Anything else is a **false positive**. Reported for all links
  and for Israeli ones separately.
- **Phishing patterns** (`data/phishing.mjs`). Each should be answered
  "uncertain" or "danger". "safe" is a **miss**. Recall = share caught.
- A misspelled brand address that forwards to the real brand
  (`paypa1.com` → `paypal.com`) is labelled as "should warn": a brand's
  defensive registration and a cloaked scam look the same from the link.
- **Hard rules** (`expect: 'danger'`). Must be answered "danger".

Google Web Risk answers "clean" for every link here. So the phishing
numbers show what is caught *before* Google has listed a link; in
production, listed links are caught on top of that.

## Limits — read before quoting a number

- The phishing links are **made-up patterns**, modelled on scams
  reported in Israel. They are not a sample of live phishing, so recall
  here is not recall in the wild.
- The rules were tuned while looking at this same set. Expect real
  traffic to do somewhat worse on both numbers.
- `data/holdout-legit.mjs` was written after tuning and is reported
  separately ("held-out"). It is the better estimate of false positives.
  Never special-case a link there; fix the rule or accept the miss.
- `no-structural-signal` is kept on purpose: generic names with nothing
  to detect. They are missed, and they keep the recall figure honest.
- Legitimate domains were written from knowledge, not verified against
  a registry. A wrong entry there would overstate false positives.

## The gate

`thresholds.json` holds the limits CI enforces. A change that raises
false positives or lowers recall past them fails the build. Tighten the
numbers when a change improves them; never loosen them without the
owner's approval.

## Adding cases

Add the link to the matching category in `data/`. A legitimate site
that got a false alarm in real use is the most valuable thing to add.
