import handler, { __setRatelimiterForTests, heuristicAnalysis } from './api/check-link.js';
import statsHandler from './api/stats.js';
import { __setRedisForTests } from './api/_lib/redis.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function mockRes() {
  const res = { _status: null, _json: null, _headers: {}, _ended: false };
  res.status = (s) => { res._status = s; return res; };
  res.json = (j) => { res._json = j; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; };
  res.end = () => { res._ended = true; return res; };
  return res;
}

function noRedirectFetch(webRiskResponder) {
  return async (url, opts) => {
    if (opts.method === 'HEAD') return { status: 200, headers: { get: () => null } };
    return webRiskResponder(url, opts);
  };
}

// Minimal in-memory stand-in for the subset of @upstash/redis commands
// api/_lib/stats.js and api/stats.js actually use — no network, no real
// Redis, but real enough to exercise the full increment-then-read path.
function makeFakeRedis() {
  const counters = new Map();
  const sets = new Map();
  return {
    _counters: counters,
    _sets: sets,
    async incr(key) {
      const v = (counters.get(key) || 0) + 1;
      counters.set(key, v);
      return v;
    },
    async get(key) {
      return counters.has(key) ? counters.get(key) : null;
    },
    async sadd(key, member) {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key).add(member);
      return 1;
    },
    async scard(key) {
      return sets.has(key) ? sets.get(key).size : 0;
    },
    async expire() {
      return 1;
    },
  };
}

async function run() {
  process.env.GOOGLE_API_KEY = 'test-key-123';

  // --- 1. Web Risk says danger -> danger, no heuristic needed ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({ threat: { threatTypes: ['MALWARE'] } }) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res); // clean domain, but Web Risk says danger
    check('web risk danger wins even on a clean-looking domain', res._json.status === 'danger', res._json);
  }

  // --- 2. Web Risk safe + heuristic also safe -> safe, combined message ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res);
    check('both safe -> safe', res._json.status === 'safe', res._json);
    check('combined message mentions structural check too', res._json.details.includes('מבנה הקישור'), res._json);
  }

  // --- 3. Web Risk safe (not yet listed) + heuristic suspicious -> uncertain, not danger ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // Web Risk: nothing found
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://amaz0n-verify-account.tk/secure/login' } }, res);
    check('brand-new suspicious link not yet on Web Risk -> uncertain (not danger)', res._json.status === 'uncertain', res._json);
  }

  // --- 4. Web Risk unavailable entirely -> heuristic is primary signal, full range including danger ---
  {
    global.fetch = noRedirectFetch(async () => { throw new Error('simulated network failure'); });
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://paypal.com@evil-site.ru/verify' } }, res);
    check('web risk down, heuristic strongly suspicious -> danger', res._json.status === 'danger', res._json);
    check('fallback note present', res._json.details.includes('בדיקה בסיסית'), res._json);
  }

  // --- 5. Web Risk unavailable + heuristic clean -> safe ---
  {
    global.fetch = noRedirectFetch(async () => { throw new Error('simulated network failure'); });
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res);
    check('web risk down, heuristic clean -> safe', res._json.status === 'safe', res._json);
  }

  // --- 6. Missing API key entirely -> still gets a heuristic-based answer, not a bare "unknown" ---
  {
    delete process.env.GOOGLE_API_KEY;
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://paypal.com@evil.example.ru/verify' } }, res);
    check('missing key -> heuristic still runs (@ trick -> danger)', res._json.status === 'danger', res._json);
    process.env.GOOGLE_API_KEY = 'test-key-123';
  }

  // --- 6b. Link pointing at a private IP -> SSRF guard blocks the fetch, but heuristic still gives a real answer ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://192.168.1.1/login' } }, res);
    check('private IP -> not a content-free unknown', res._json.status !== 'unknown', res._json);
    check('private IP -> reason mentions internal network', res._json.details.includes('פרטית'), res._json);
  }

  // --- 7. Previously-passing basics still hold: method/input validation ---
  {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    check('GET -> 405', res._status === 405, res);
  }
  {
    const res = mockRes();
    await handler({ method: 'POST', body: {} }, res);
    check('missing link -> 400', res._status === 400, res);
  }

  // --- 8. SSRF guard still blocks the fetch, and now gives a useful (not content-free) verdict ---
  {
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD') {
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'http://169.254.169.254/latest/meta-data/' : null) } };
      }
      throw new Error('should not reach this point for an SSRF case');
    };
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://evil-redirector.example.com/go' } }, res);
    check('SSRF redirect (to cloud metadata endpoint) -> danger, not a content-free unknown', res._json.status === 'danger', res._json);
  }

  // --- 9. lang='en' -> details come back in English ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({ threat: { threatTypes: ['MALWARE'] } }) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com', lang: 'en' } }, res);
    check('lang=en -> English threat label in details', res._json.details.includes('Malware'), res._json);
  }

  // --- 10. lang='fr' heuristic-only fallback -> French reasons ---
  {
    global.fetch = noRedirectFetch(async () => { throw new Error('simulated network failure'); });
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://paypal.com@evil-site.ru/verify', lang: 'fr' } }, res);
    check('lang=fr -> French fallback note present', res._json.details.includes('Vérification de base'), res._json);
  }

  // --- 11. lang='ar' safe+safe combined message -> Arabic suffix ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com', lang: 'ar' } }, res);
    check('lang=ar -> Arabic combined-safe suffix present', res._json.details.includes('بنية الرابط'), res._json);
  }

  // --- 12. unsupported/unknown lang code -> silently falls back to Hebrew (the default) ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com', lang: 'de' } }, res);
    check('unsupported lang -> defaults to Hebrew', res._json.details.includes('מבנה הקישור'), res._json);
  }

  // --- 13. Web Risk reachable and says "safe" (not yet catalogued), but
  // the @ trick is present -> escalates straight to danger (high-
  // confidence pattern), NOT just "uncertain" like a weaker signal would.
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // Web Risk: nothing found
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://paypal.com@evil-fake-site.ru/login' } }, res);
    check('@ trick escalates to danger even when Web Risk is silent', res._json.status === 'danger', res._json);
  }

  // --- 14. Same, but with a raw public IP standing in for a domain ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://203.0.113.5/verify-account' } }, res);
    check('raw IP escalates to danger even when Web Risk is silent', res._json.status === 'danger', res._json);
  }

  // --- 15. Sanity check: a merely-suspicious combo (http + cheap TLD +
  // urgent wording, no @ and no raw IP) still stays "uncertain", not
  // "danger" — confirming the escalation is balanced, not blanket.
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://my-shop-login.top/secure/account' } }, res);
    check('weak-signal combo (no @/IP) stays uncertain, not danger', res._json.status === 'uncertain', res._json);
  }

  // --- 16. OPTIONS preflight is answered directly (204, no body), not
  // rejected as an unsupported method -> this is what lets a browser-based
  // client (the web/PWA build) actually reach the POST that follows.
  {
    const res = mockRes();
    await handler({ method: 'OPTIONS' }, res);
    check('OPTIONS preflight -> 204', res._status === 204, res);
    check('OPTIONS preflight -> ended without a JSON body', res._ended === true && res._json === null, res);
  }

  // --- 17. CORS: only an allowlisted (or localhost) Origin gets echoed back
  // in Access-Control-Allow-Origin -- this is browser-only enforcement, the
  // mobile app ignores the header entirely and isn't affected either way ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));

    let res = mockRes();
    await handler({ method: 'POST', headers: { origin: 'https://verifyweb-phi.vercel.app' }, body: { link: 'https://www.google.com' } }, res);
    check('CORS: allowed origin is echoed back', res._headers['Access-Control-Allow-Origin'] === 'https://verifyweb-phi.vercel.app', res);

    res = mockRes();
    await handler({ method: 'POST', headers: { origin: 'https://verifyweb-preview-abc123.vercel.app' }, body: { link: 'https://www.google.com' } }, res);
    check('CORS: a Vercel preview deployment of the PWA is also allowed', res._headers['Access-Control-Allow-Origin'] === 'https://verifyweb-preview-abc123.vercel.app', res);

    res = mockRes();
    await handler({ method: 'POST', headers: { origin: 'http://localhost:8081' }, body: { link: 'https://www.google.com' } }, res);
    check('CORS: localhost (local web dev) is always allowed', res._headers['Access-Control-Allow-Origin'] === 'http://localhost:8081', res);

    res = mockRes();
    await handler({ method: 'POST', headers: { origin: 'https://evil.example.com' }, body: { link: 'https://www.google.com' } }, res);
    check('CORS: an unrecognized origin gets no header', res._headers['Access-Control-Allow-Origin'] === undefined, res);

    res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res);
    check('CORS: no Origin header (native app / curl) gets no header', res._headers['Access-Control-Allow-Origin'] === undefined, res);
  }

  // --- 18. Shared secret configured + missing/wrong header -> 401, JSON body (not a raw framework error) ---
  {
    process.env.APP_SECRET = 'test-secret-abc';
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, body: { link: 'https://www.google.com' } }, res);
    check('missing x-app-secret -> 401', res._status === 401, res);
    check('missing x-app-secret -> unknown status, JSON body', res._json && res._json.status === 'unknown', res._json);
  }

  // --- 19. Shared secret configured + correct header -> request proceeds normally ---
  {
    process.env.APP_SECRET = 'test-secret-abc';
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-app-secret': 'test-secret-abc' }, body: { link: 'https://www.google.com' } }, res);
    check('correct x-app-secret -> request proceeds (safe)', res._json.status === 'safe', res._json);
    delete process.env.APP_SECRET; // back to "not configured" for every test below
  }

  // --- 20. APP_SECRET not set on the server -> check is skipped entirely, no header needed ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, body: { link: 'https://www.google.com' } }, res);
    check('APP_SECRET unset -> no auth required, request proceeds', res._json.status === 'safe', res._json);
  }

  // --- 21. Rate limiter reports the IP is over its budget -> 429, JSON body in the existing format ---
  {
    __setRatelimiterForTests({ limit: async () => ({ success: false, reset: Date.now() + 60000 }) });
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: { link: 'https://www.google.com' } }, res);
    check('rate limited -> 429', res._status === 429, res);
    check('rate limited -> unknown status, JSON body', res._json && res._json.status === 'unknown', res._json);
    check('rate limited -> Retry-After header set', !!res._headers['Retry-After'], res._headers);
  }

  // --- 22. Rate limiter allows the request through -> normal flow, unaffected ---
  {
    __setRatelimiterForTests({ limit: async () => ({ success: true, reset: Date.now() + 60000 }) });
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: { link: 'https://www.google.com' } }, res);
    check('rate limit allows -> request proceeds (safe)', res._json.status === 'safe', res._json);
    __setRatelimiterForTests(null); // back to "not configured" (skipped) for every test above/below relying on that
  }

  // --- 23. Rate limiter not configured at all (no override, no env vars) -> skipped, request proceeds ---
  // Covered implicitly by every earlier test (none of them set UPSTASH_* or an override) — this just makes
  // the guarantee explicit and catches a regression where rate limiting accidentally becomes mandatory.
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '5.6.7.8' }, body: { link: 'https://www.google.com' } }, res);
    check('rate limiter unconfigured -> not blocked', res._json.status === 'safe', res._json);
  }

  // --- 24. A completed check increments the total + per-status counters, and
  // never stores the checked link's own content anywhere in Redis. ---
  {
    const fakeRedis = makeFakeRedis();
    __setRedisForTests(fakeRedis);
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({ threat: { threatTypes: ['MALWARE'] } }) }));
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: { link: 'https://www.google.com/some-distinctive-path-abc123' } }, res);
    check('danger check -> counted in total', fakeRedis._counters.get('stats:total') === 1, fakeRedis._counters);
    check('danger check -> counted in per-status counter', fakeRedis._counters.get('stats:status:danger') === 1, fakeRedis._counters);

    const allStoredValues = [
      ...fakeRedis._counters.keys(), ...fakeRedis._counters.values(),
      ...[...fakeRedis._sets.values()].flatMap((s) => [...s]),
    ].map(String);
    check('link content never stored in Redis', !allStoredValues.some((v) => v.includes('distinctive-path-abc123')), allStoredValues);
    check('raw IP never stored in Redis', !allStoredValues.some((v) => v.includes('9.9.9.9')), allStoredValues);
  }

  // --- 25. A second check (different status) accumulates rather than overwrites, and adds to today's unique-user set ---
  {
    const fakeRedis = makeFakeRedis(); // fresh instance, still active from test 24's __setRedisForTests
    __setRedisForTests(fakeRedis);
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // safe
    const res1 = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: { link: 'https://www.google.com' } }, res1);
    const res2 = mockRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '8.8.8.8' }, body: { link: 'https://www.google.com' } }, res2);
    check('two checks -> total is 2', fakeRedis._counters.get('stats:total') === 2, fakeRedis._counters);
    check('two safe checks -> safe counter is 2', fakeRedis._counters.get('stats:status:safe') === 2, fakeRedis._counters);
    const today = new Date().toISOString().slice(0, 10);
    check('two distinct IPs -> 2 unique users today', fakeRedis._sets.get('stats:dau:' + today).size === 2, fakeRedis._sets);

    // --- 26. /api/stats reads back exactly what was just recorded ---
    {
      process.env.STATS_SECRET = 'top-secret';
      const statsRes = mockRes();
      await statsHandler({ method: 'GET', headers: {}, query: { secret: 'top-secret' } }, statsRes);
      check('stats -> 200', statsRes._status === 200, statsRes);
      check('stats -> totalChecks matches', statsRes._json.totalChecks === 2, statsRes._json);
      check('stats -> byStatus.safe matches', statsRes._json.byStatus.safe === 2, statsRes._json);
      check('stats -> uniqueUsersByDay[today] matches', statsRes._json.uniqueUsersByDay[today] === 2, statsRes._json);
    }

    __setRedisForTests(null); // back to "not configured" (skipped) for every test outside this block
  }

  // --- 27. /api/stats without the secret (or with the wrong one) -> 401, no data leaked ---
  {
    process.env.STATS_SECRET = 'top-secret';
    const res1 = mockRes();
    await statsHandler({ method: 'GET', headers: {}, query: {} }, res1);
    check('stats, no secret -> 401', res1._status === 401, res1);
    const res2 = mockRes();
    await statsHandler({ method: 'GET', headers: { 'x-stats-secret': 'wrong' }, query: {} }, res2);
    check('stats, wrong secret -> 401', res2._status === 401, res2);
    delete process.env.STATS_SECRET;
  }

  // --- 28. STATS_SECRET not configured on the server at all -> 401 even with a guess, never silently open ---
  // (Deliberately the opposite default from APP_SECRET/rate limiting: those
  // fail OPEN when unconfigured, but a stats-viewing endpoint should never
  // fail open, or forgetting to set the secret would expose it to anyone.)
  {
    const res = mockRes();
    await statsHandler({ method: 'GET', headers: {}, query: { secret: 'anything' } }, res);
    check('STATS_SECRET unset -> still 401, never open by default', res._status === 401, res);
  }

  // ============================================================
  // Heuristic v2 signals -- direct unit tests against
  // heuristicAnalysis() itself (no fetch mocking needed: these are
  // pure structural checks on the URL string, same pattern as
  // mobile/test-extract-urls.mjs tests extractUrls() directly).
  // ============================================================

  // --- 29. Legitimate domains: none of the new signals should fire ---
  {
    const legitimate = [
      'https://google.com',
      'https://www.google.com',
      'https://login.paypal.com',
      'https://www.amazon.com',
      'https://gov.il',
    ];
    for (const url of legitimate) {
      const h = heuristicAnalysis(url, 'he');
      check(`legitimate: ${url} -> safe`, h.verdict === 'safe', h);
    }
  }

  // --- 30. Typosquatting: close edit-distance / leetspeak matches against
  // KNOWN_SAFE_DOMAINS get flagged, and specifically name the real brand ---
  {
    const typosquats = [
      ['https://paypa1.com', 'paypal.com'],
      ['https://paypall.com', 'paypal.com'],
      ['https://g00gle.com', 'google.com'],
      ['https://micr0soft.com', 'microsoft.com'],
    ];
    for (const [url, brand] of typosquats) {
      const h = heuristicAnalysis(url, 'he');
      check(`typosquat: ${url} -> not safe`, h.verdict !== 'safe', h);
      check(`typosquat: ${url} -> reason names ${brand}`, h.reasons.some((r) => r.includes(brand)), h);
      check(`typosquat: ${url} -> stays below highConfidence`, h.highConfidence === false, h);
    }
  }

  // --- 31. Subdomain deception: an exact known domain embedded as a fake
  // subdomain of someone else's domain is flagged; a REAL subdomain of the
  // real domain is not; a brand keyword loose in a subdomain still falls
  // through to the existing (unchanged) brand-keyword check ---
  {
    let h = heuristicAnalysis('https://paypal.com.evil.com', 'he');
    check('subdomain decoy: paypal.com.evil.com -> not safe', h.verdict !== 'safe', h);
    check('subdomain decoy: reason names paypal.com', h.reasons.some((r) => r.includes('paypal.com')), h);

    h = heuristicAnalysis('https://login.paypal.com', 'he');
    check('real subdomain: login.paypal.com -> safe, not a decoy', h.verdict === 'safe', h);

    h = heuristicAnalysis('https://paypal.security.example.com', 'he');
    check('brand keyword in a subdomain of an unrelated domain -> not safe', h.verdict !== 'safe', h);
  }

  // --- 32. Unicode homoglyphs: a single confusable character swapped into
  // an otherwise-Latin brand name is flagged; a fully non-Latin domain
  // (no script mixing) is not touched by this signal ---
  {
    const cyrillicA = 'а'; // U+0430 CYRILLIC SMALL LETTER A, not ASCII "a"
    let h = heuristicAnalysis(`https://${cyrillicA}pple.com`, 'he');
    check('homoglyph: Cyrillic а + "pple.com" -> not safe', h.verdict !== 'safe', h);
    check('homoglyph: reason mentions foreign-alphabet characters', h.reasons.some((r) => r.includes('אלפבית זר')), h);

    const greekOmicron = 'ο'; // U+03BF GREEK SMALL LETTER OMICRON
    h = heuristicAnalysis(`https://g${greekOmicron}ogle.com`, 'he');
    check('homoglyph: Greek omicron in "google.com" -> not safe', h.verdict !== 'safe', h);
    check('homoglyph (2nd example): reason mentions foreign-alphabet characters', h.reasons.some((r) => r.includes('אלפבית זר')), h);

    // A domain that's genuinely, entirely written in another script (e.g. a
    // real Hebrew business name) has nothing Latin to "mix" with, so this
    // signal must stay silent -- flagging it would be exactly the kind of
    // false positive this feature is required not to introduce.
    h = heuristicAnalysis('https://דוגמה.ישראל', 'he');
    check('non-Latin domain with no script mixing -> homoglyph signal silent', !h.reasons.some((r) => r.includes('אלפבית זר')), h);
  }

  // --- 33. Encoding obfuscation: a brand name spelled out entirely via
  // percent-encoding, a double-encoded sequence, and an encoded delimiter
  // in the path all get flagged; ordinary encoding in a query string
  // (an email address, an embedded redirect URL) does not ---
  {
    let h = heuristicAnalysis('https://evil.com/%70%61%79%70%61%6C', 'he'); // spells "paypal"
    check('encoding: letters spelled via percent-encoding -> not safe', h.verdict !== 'safe', h);
    check('encoding: reason present', h.reasons.some((r) => r.includes('קידוד')), h);

    h = heuristicAnalysis('https://evil.com/x?r=%2540', 'he'); // %25 + "40" -> double-encoded %40
    check('encoding: double-encoded sequence -> not safe', h.verdict !== 'safe', h);

    h = heuristicAnalysis('https://evil.com/path%2Fsegment%40hidden', 'he'); // encoded / and @ in the path
    check('encoding: encoded delimiter in path -> not safe', h.verdict !== 'safe', h);

    h = heuristicAnalysis('https://shop.example.com/redirect?to=https%3A%2F%2Fexample.com%2Fcart&email=user%40example.com', 'he');
    check('encoding: ordinary query-string encoding (email, embedded URL) -> encoding signal stays silent', !h.reasons.some((r) => r.includes('קידוד')), h);
  }

  // --- 34. URL complexity: a very long URL with many path segments and
  // query parameters is flagged as a weak signal; a normal URL is not ---
  {
    const longPath = '/' + Array.from({ length: 12 }, (_, i) => `segment${i}`).join('/');
    const manyParams = Array.from({ length: 15 }, (_, i) => `p${i}=value${i}`).join('&');
    const complexUrl = `https://example.com${longPath}?${manyParams}&` + 'x'.repeat(200);
    let h = heuristicAnalysis(complexUrl, 'he');
    check('complexity: very long URL with many segments/params -> not safe', h.verdict !== 'safe', h);
    check('complexity: reason present', h.reasons.some((r) => r.includes('מורכב')), h);

    h = heuristicAnalysis('https://example.com/products/item?id=42', 'he');
    check('complexity: an ordinary URL stays unflagged by this signal', !h.reasons.some((r) => r.includes('מורכב')), h);
  }

  // --- 35. Existing high-confidence cases still set highConfidence exactly
  // as before -- the new signals must never touch this ---
  {
    const stillHighConfidence = [
      'http://127.0.0.1/login',
      'http://192.168.1.50/verify',
      'http://10.0.0.5/account',
      'http://203.0.113.9/secure',
      'https://google.com@evil.com',
    ];
    for (const url of stillHighConfidence) {
      const h = heuristicAnalysis(url, 'he');
      check(`existing high-confidence case intact: ${url}`, h.highConfidence === true, h);
    }
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run();
