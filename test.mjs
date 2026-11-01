import handler, {
  __setRatelimiterForTests, heuristicAnalysis,
  __setHopRequestForTests, __setConnectLookupForTests, __setRedirectBudgetForTests, __guardedLookupForTests, __guardedHopForTests,
} from './api/check-link.js';
import statsHandler from './api/stats.js';
import { __setRedisForTests } from './api/_lib/redis.js';
import { infrastructureAnalysis, __setDnsForTests, __setRdapFetchForTests } from './api/_lib/infrastructure.js';

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

// Default fake DNS resolver: every lookup fails, exactly like a domain
// with no real infrastructure behind it would -- infrastructure.js already
// treats any lookup failure as "no data" (empty array), so this keeps
// every existing test's infra contribution at score=0/reasons=[], with NO
// live network calls, consistent with this project's "mocked fetch, no
// live API calls" testing philosophy. Individual infra-focused tests below
// override specific fields via makeFakeDns({...}).
function makeFakeDns(overrides) {
  const reject = () => Promise.reject(new Error('ENOTFOUND (fake)'));
  return {
    resolve4: overrides?.a ? async () => overrides.a : reject,
    resolve6: overrides?.aaaa ? async () => overrides.aaaa : reject,
    resolveCname: overrides?.cname ? async () => overrides.cname : reject,
    resolveMx: overrides?.mx ? async () => overrides.mx : reject,
    resolveNs: overrides?.ns ? async () => overrides.ns : reject,
  };
}

// Default fake RDAP fetch: always fails (no live network), matching how a
// real "RDAP unsupported/unreachable for this TLD" case degrades -- see
// domainAgeDays() in infrastructure.js, which treats this as "no data".
function makeFakeRdapFetch(responder) {
  return responder || (async () => { throw new Error('fake RDAP unreachable'); });
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
  // No live DNS/RDAP calls for the existing test suite -- see makeFakeDns
  // above. Infra-specific tests further down install their own overrides
  // and restore this default afterwards.
  __setDnsForTests(makeFakeDns());
  __setRdapFetchForTests(makeFakeRdapFetch());
  // Redirect hops normally go through node:http with the connect-time SSRF
  // lookup (see guardedHop in check-link.js). Route them through whatever
  // global.fetch mock the test installed instead, so every test below keeps
  // controlling both the hops and Web Risk from one place, with no live
  // network calls. Tests that exercise the real guarded path clear this.
  const hopViaMockedFetch = (url, opts) => global.fetch(url, opts);
  __setHopRequestForTests(hopViaMockedFetch);

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

  // ============================================================
  // Infrastructure / DNS layer -- direct unit tests against
  // infrastructureAnalysis() itself, using fake DNS/RDAP so
  // everything stays fast and network-free.
  // ============================================================

  // --- 36. Legitimate domain: no DNS-based signals, clean result ---
  {
    __setDnsForTests(makeFakeDns({ a: ['93.184.216.34'], ns: ['a.iana-servers.net', 'b.iana-servers.net'] }));
    const infra = await infrastructureAnalysis('https://example.com', 'he');
    check('infra: legitimate domain -> score 0', infra.score === 0, infra);
    check('infra: legitimate domain -> no reasons', infra.reasons.length === 0, infra);
    check('infra: legitimate domain -> available', infra.available === true, infra);
  }

  // --- 36b. Explicitly-requested legitimate set: google.com / amazon.com /
  // gov.il -- clean DNS, and RDAP unreachable (the real situation for
  // gov.il, simulated here for all three for consistency) -> no signals ---
  {
    __setDnsForTests(makeFakeDns({ a: ['142.250.1.1'], ns: ['ns1.google.com', 'ns2.google.com'] }));
    __setRdapFetchForTests(makeFakeRdapFetch()); // unreachable/no data
    for (const domain of ['https://google.com', 'https://amazon.com', 'https://gov.il']) {
      const infra = await infrastructureAnalysis(domain, 'he');
      check(`infra: legitimate domain ${domain} -> score 0`, infra.score === 0, infra);
    }
  }

  // --- 37. Domain that fails to resolve at all: must not crash, must not
  // be treated as suspicious -- DNS failure is not itself a phishing signal ---
  {
    __setDnsForTests(makeFakeDns()); // every lookup rejects, like NXDOMAIN
    const infra = await infrastructureAnalysis('https://this-domain-does-not-exist-xyz.example', 'he');
    check('infra: NXDOMAIN-style failure -> score 0, no crash', infra.score === 0, infra);
    check('infra: NXDOMAIN-style failure -> no reasons', infra.reasons.length === 0, infra);
  }

  // --- 38. A record resolves to a private/internal IPv4 address: strong
  // score signal, but NEVER highConfidence (independent-resolve TOCTOU) ---
  {
    const privateIPv4Cases = ['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254'];
    for (const ip of privateIPv4Cases) {
      __setDnsForTests(makeFakeDns({ a: [ip], ns: ['ns1.example.com'] }));
      const infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
      check(`infra: A record -> ${ip} -> flagged`, infra.score > 0, infra);
      check(`infra: A record -> ${ip} -> reason present`, infra.reasons.some((r) => r.includes('פרטית')), infra);
      check(`infra: A record -> ${ip} -> NEVER highConfidence (no such field)`, infra.highConfidence === undefined, infra);
    }
  }

  // --- 39. IPv6 private/special cases, incl. IPv4-mapped IPv6 ---
  {
    const privateIPv6Cases = ['::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'];
    for (const ip of privateIPv6Cases) {
      __setDnsForTests(makeFakeDns({ aaaa: [ip], ns: ['ns1.example.com'] }));
      const infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
      check(`infra: AAAA record -> ${ip} -> flagged`, infra.score > 0, infra);
    }
  }

  // --- 40. A normal public IP must NOT be flagged ---
  {
    __setDnsForTests(makeFakeDns({ a: ['8.8.8.8'], ns: ['ns1.example.com'] }));
    const infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
    check('infra: public IP -> not flagged', infra.score === 0, infra);
  }

  // --- 40b. RFC 5737 TEST-NET ranges (documentation-only, never a real
  // public destination) -- explicit coverage for all three ranges, not
  // just an incidental hit in an unrelated test ---
  {
    const testNetCases = ['192.0.2.1', '198.51.100.1', '203.0.113.1'];
    for (const ip of testNetCases) {
      __setDnsForTests(makeFakeDns({ a: [ip], ns: ['ns1.example.com'] }));
      const infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
      check(`infra: TEST-NET ${ip} -> flagged as non-public`, infra.score > 0, infra);
    }
  }

  // --- 41. Zero NS records is NOT scored (dropped after live testing showed
  // a real resolver can fail NS queries for entirely legitimate domains,
  // e.g. google.com itself -- see the note in infrastructure.js). NS data
  // is still captured for context/future use when it IS available. ---
  {
    __setDnsForTests(makeFakeDns({ a: ['93.184.216.34'], ns: [] }));
    let infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
    check('infra: no NS records -> not scored', infra.score === 0, infra);

    __setDnsForTests(makeFakeDns({ a: ['93.184.216.34'], ns: ['ns1.example.com', 'ns2.example.com'] }));
    infra = await infrastructureAnalysis('https://evil-domain.example', 'he');
    check('infra: NS records are captured in the result when present', infra.ns.length === 2, infra);
  }

  // --- 42. Domain age via RDAP: very new (<7d), moderately new (<30d),
  // and old (no signal) -- and the exact registrable domain (not the full
  // hostname) is what gets queried ---
  {
    __setDnsForTests(makeFakeDns());
    let queriedUrl = null;
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

    __setRdapFetchForTests(async (url) => {
      queriedUrl = url;
      return { ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: daysAgo(3) }] }) };
    });
    let infra = await infrastructureAnalysis('https://login.newly-registered-example.com', 'he');
    check('infra: <7 day old domain -> flagged', infra.score > 0, infra);
    check('infra: RDAP queried the registrable domain, not the full hostname', queriedUrl.includes('newly-registered-example.com') && !queriedUrl.includes('login.'), queriedUrl);

    __setRdapFetchForTests(async () => ({ ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: daysAgo(15) }] }) }));
    infra = await infrastructureAnalysis('https://somewhat-new-example.com', 'he');
    check('infra: 15 day old domain -> weak signal', infra.score > 0, infra);

    __setRdapFetchForTests(async () => ({ ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: daysAgo(4000) }] }) }));
    infra = await infrastructureAnalysis('https://google.com', 'he');
    check('infra: long-established domain -> no age signal', infra.score === 0, infra);

    __setRdapFetchForTests(makeFakeRdapFetch()); // back to "unreachable/no data" default
  }

  // --- 43. RDAP unavailable for the domain's TLD (the real .il situation,
  // simulated here as an HTTP 404 from the bootstrap) -> silent no-op, NOT
  // treated as suspicious ---
  {
    __setDnsForTests(makeFakeDns());
    __setRdapFetchForTests(async () => ({ ok: false, status: 404 }));
    const infra = await infrastructureAnalysis('https://gov.il', 'he');
    check('infra: RDAP 404 (e.g. .il) -> no penalty', infra.score === 0, infra);
    __setRdapFetchForTests(makeFakeRdapFetch());
  }

  // --- 44. A DNS lookup that never resolves must not block the layer past
  // its own timeout/budget ---
  {
    const hang = new Promise(() => {}); // never settles
    __setDnsForTests({
      resolve4: () => hang, resolve6: () => hang, resolveCname: () => Promise.reject(new Error('x')),
      resolveMx: () => Promise.reject(new Error('x')), resolveNs: () => Promise.reject(new Error('x')),
    });
    const t0 = Date.now();
    const infra = await infrastructureAnalysis('https://slow-dns-example.com', 'he');
    const elapsedMs = Date.now() - t0;
    check('infra: hanging DNS lookup still resolves within budget', elapsedMs < 2500, elapsedMs);
    check('infra: hanging DNS lookup -> graceful empty result, no crash', infra.score === 0, infra);
    __setDnsForTests(makeFakeDns());
  }

  // --- 45. Race pattern, end to end through the full handler: Web Risk
  // "danger" returns FAST without waiting for a hanging infrastructure
  // lookup (fire-and-forget, no AbortController complexity needed) ---
  {
    const hang = new Promise(() => {});
    __setDnsForTests({
      resolve4: () => hang, resolve6: () => hang, resolveCname: () => hang, resolveMx: () => hang, resolveNs: () => hang,
    });
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({ threat: { threatTypes: ['MALWARE'] } }) }));
    const res = mockRes();
    const t0 = Date.now();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res);
    const elapsedMs = Date.now() - t0;
    check('race pattern: Web Risk danger returns fast, does not wait for hanging infra', elapsedMs < 300, elapsedMs);
    check('race pattern: status is still danger', res._json.status === 'danger', res._json);
    __setDnsForTests(makeFakeDns());
  }

  // --- 46. Race pattern: when Web Risk is NOT "danger" (safe here), the
  // full handler DOES wait for infrastructure and folds its signal in ---
  {
    __setDnsForTests(makeFakeDns({ a: ['192.168.1.1'], ns: ['ns1.example.com'] })); // private IP behind the domain
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // Web Risk: nothing found
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://looks-clean-but-isnt.example' } }, res);
    check('race pattern: non-danger path waits for and reflects infra signal', res._json.status !== 'safe', res._json);
    check('race pattern: still not an automatic "danger" (no highConfidence from infra)', res._json.status !== 'danger', res._json);
    __setDnsForTests(makeFakeDns());
  }

  // ============================================================
  // Round 1 backend hardening: userinfo-only "@", literal + connect-time
  // SSRF guard, raw IPv6, redirect-chain budget, narrowed .il exemption.
  // ============================================================

  // --- 47. "@" only counts in the userinfo part. An "@" in the query or
  // path (unsubscribe links, medium.com/@user) is ordinary and must never
  // force "danger" past a clean Web Risk result. ---
  {
    for (const url of ['https://shop.example.com/unsubscribe?email=a@b.com', 'https://medium.com/@someone/a-post']) {
      const h = heuristicAnalysis(url, 'he');
      check(`@ outside userinfo: ${url} -> not highConfidence`, h.highConfidence === false, h);
      check(`@ outside userinfo: ${url} -> no @-trick reason`, !h.reasons.some((r) => r.includes('סימן @')), h);
    }
    for (const url of ['http://paypal.com@evil.example.ru/', 'http://user:pass@evil.example.ru/', 'http://@evil.example.ru/']) {
      const h = heuristicAnalysis(url, 'he');
      check(`@ in userinfo: ${url} -> still highConfidence`, h.highConfidence === true, h);
    }

    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // Web Risk: nothing found
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://news.example.com/unsubscribe?email=a@b.com' } }, res);
    check('@ in query + Web Risk clean -> not danger', res._json.status !== 'danger', res._json);
  }

  // --- 48. Literal SSRF guard covers every non-public range, including the
  // spellings the old prefix regexes missed -- and refuses before ANY hop
  // is attempted ---
  {
    const literalPrivate = [
      'http://[::ffff:127.0.0.1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::]/',
      'http://0.1.2.3/', 'http://100.64.0.1/', 'http://localhost./', 'http://127.0.0.1./', 'http://0x7f.1/',
    ];
    for (const link of literalPrivate) {
      let hopCalls = 0;
      // Web Risk is still asked (an API call, not a connection to the URL);
      // only an actual redirect hop to the private host must never happen.
      global.fetch = async (url, opts) => { if (opts.redirect === 'manual') hopCalls++; throw new Error('must not be reached for a private literal'); };
      const res = mockRes();
      await handler({ method: 'POST', body: { link } }, res);
      check(`literal SSRF: ${link} -> no hop attempted`, hopCalls === 0, hopCalls);
      check(`literal SSRF: ${link} -> danger`, res._json.status === 'danger', res._json);
      check(`literal SSRF: ${link} -> reason mentions internal network`, res._json.details.includes('פרטית'), res._json);
    }
  }

  // --- 49. Raw IP literals: a public IPv6 literal is the same "raw IP
  // instead of a domain" pattern as dotted IPv4; a public IPv4 still
  // escalates through the normal (non-SSRF) path ---
  {
    const h = heuristicAnalysis('http://[2001:4860:4860::8888]/login', 'he');
    check('raw public IPv6 -> highConfidence', h.highConfidence === true, h);
    check('raw public IPv6 -> public-IP reason, not private', h.reasons.some((r) => r.includes('IP ציבורית')) && !h.reasons.some((r) => r.includes('פרטית')), h);

    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'http://8.8.4.4/verify-account' } }, res);
    check('raw public IPv4 (not TEST-NET) -> danger via heuristic path', res._json.status === 'danger' && !res._json.details.includes('פרטית'), res._json);
  }

  // --- 50. Connect-time SSRF guard: a public-looking hostname whose DNS
  // answer (the one the connection itself would use) is private is refused
  // before connecting -- but, like any DNS-derived private IP, that alone
  // never forces "danger": it lands on "uncertain". Uses the real
  // guarded hop with a fake lookup -- the lookup refuses, so no socket is
  // ever opened. ---
  {
    __setHopRequestForTests(null);
    for (const answer of [
      [{ address: '169.254.169.254', family: 4 }],
      [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }], // mixed answer
    ]) {
      const looked = [];
      __setConnectLookupForTests(async (host) => { looked.push(host); return answer; });
      global.fetch = async () => { throw new Error('Web Risk must not be reached after an SSRF refusal'); };
      const res = mockRes();
      await handler({ method: 'POST', body: { link: 'http://rebind.example.com/x' } }, res);
      check(`connect-time SSRF (${answer.map((a) => a.address).join(',')}) -> lookup ran on the real hostname`, looked[0] === 'rebind.example.com', looked);
      check(`connect-time SSRF (${answer.map((a) => a.address).join(',')}) -> uncertain, not danger`, res._json.status === 'uncertain', res._json);
      check(`connect-time SSRF (${answer.map((a) => a.address).join(',')}) -> reason mentions internal network`, res._json.details.includes('פרטית'), res._json);
    }

    // The allow/deny decision itself, without opening a socket.
    const lookupOnce = (answer, opts) => new Promise((resolve) => {
      __setConnectLookupForTests(async () => answer);
      __guardedLookupForTests('example.com', opts, (err, address, family) => resolve({ err, address, family }));
    });
    let out = await lookupOnce([{ address: '93.184.216.34', family: 4 }], {});
    check('guardedLookup: public answer -> passed through', !out.err && out.address === '93.184.216.34' && out.family === 4, out);
    out = await lookupOnce([{ address: '2606:2800:220:1::1', family: 6 }, { address: '93.184.216.34', family: 4 }], { all: true });
    check('guardedLookup: { all: true } -> full public list', !out.err && Array.isArray(out.address) && out.address.length === 2, out);
    out = await lookupOnce([{ address: '2606:2800:220:1::1', family: 6 }, { address: '93.184.216.34', family: 4 }], { family: 4 });
    check('guardedLookup: family filter respected', !out.err && out.address === '93.184.216.34', out);
    out = await lookupOnce([{ address: '::ffff:127.0.0.1', family: 6 }], {});
    check('guardedLookup: IPv4-mapped loopback -> refused as SSRF', out.err && out.err.ssrf === true && out.err.refusedAtConnect === true, out.err);
    out = await lookupOnce([], {});
    check('guardedLookup: empty answer -> ENOTFOUND, not SSRF', out.err && out.err.code === 'ENOTFOUND' && !out.err.ssrf, out.err);

    __setConnectLookupForTests(null);
    __setHopRequestForTests(hopViaMockedFetch);
  }

  // --- 51. Redirect-chain budget: a chain that stalls mid-way stops at the
  // budget and checks the last URL it reached, instead of running past
  // vercel.json's maxDuration -- and since the destination was never
  // seen, the answer is capped at "uncertain", never "safe" ---
  {
    __setRedirectBudgetForTests(300);
    let webRiskUri = null;
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD' && url.startsWith('https://start.example.com')) {
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'https://hop2.example.com/landing' : null) } };
      }
      if (opts.method === 'HEAD' || opts.method === 'GET' && opts.redirect === 'manual') return new Promise(() => {}); // stalls forever
      webRiskUri = new URL(url).searchParams.get('uri');
      return { ok: true, json: async () => ({}) };
    };
    const res = mockRes();
    const t0 = Date.now();
    await handler({ method: 'POST', body: { link: 'https://start.example.com/go' } }, res);
    const elapsedMs = Date.now() - t0;
    check('redirect budget: stalled chain returns within budget', elapsedMs < 1500, elapsedMs);
    check('redirect budget: last reached URL is the one checked', webRiskUri === 'https://hop2.example.com/landing', webRiskUri);
    check('redirect budget: incomplete chain -> 200 uncertain, never safe', res._status === 200 && res._json.status === 'uncertain', res._json);
    check('redirect budget: reason says the chain was not followed to the end', res._json.details.includes('שרשרת ההפניות'), res._json);
    __setRedirectBudgetForTests(null);
  }

  // --- 52. .il exemption covers generic noise only. Weak structural noise
  // on a .il site is still "safe" after a clean Web Risk result, but brand
  // mimicry, a typosquat, a homoglyph or a DNS-private destination keeps it
  // at "uncertain" (never "danger" -- none of these force it) ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) })); // Web Risk: nothing found
    const verdictFor = async (link) => {
      const res = mockRes();
      await handler({ method: 'POST', body: { link } }, res);
      return res._json;
    };

    let r = await verdictFor('http://a.b.c.small-shop.co.il/'); // plain http + many subdomains: generic noise
    check('.il weak noise only -> still safe', r.status === 'safe', r);
    r = await verdictFor('https://www.leumi.co.il');
    check('.il known-safe domain -> safe', r.status === 'safe', r);

    for (const link of ['https://leumi-secure.co.il/login', 'https://lewmi.co.il', 'https://lеumi.co.il']) { // brand keyword, typosquat, Cyrillic е
      r = await verdictFor(link);
      check(`.il strong signal: ${link} -> uncertain, not safe`, r.status === 'uncertain', r);
    }

    __setDnsForTests(makeFakeDns({ a: ['10.0.0.5'] }));
    r = await verdictFor('https://intranet-portal.co.il');
    check('.il with DNS-private destination -> uncertain (not safe, not danger)', r.status === 'uncertain', r);
    __setDnsForTests(makeFakeDns());
  }

  // ============================================================
  // Round 1 QA matrix (קאי's case list + אבי's review requests).
  // Web Risk mocked "safe" unless stated; DNS/RDAP faked; no network.
  // ============================================================

  const webRiskSafe = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
  const runLink = async (link) => {
    const res = mockRes();
    await handler({ method: 'POST', body: { link } }, res);
    return res._json;
  };

  // --- 53. Literal private/internal hosts: no hop to them, danger, and
  // highConfidence in the heuristic itself ---
  {
    const cases = [
      'http://localhost./admin', 'http://foo.localhost/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:a9fe:a9fe]/',
      'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::]/', 'http://[0:0:0:0:0:0:0:1]/', 'http://0.1.2.3/',
      'http://100.100.100.200/', 'http://0x7f.1/', 'http://2130706433/', 'http://127.1/', 'http://[64:ff9b::7f00:1]/',
      'http://[2001:db8::1]/', 'http://[::ffff:203.0.113.5]/', 'http://user@192.0.2.1/',
    ];
    for (const link of cases) {
      let hopCalls = 0;
      global.fetch = async (url, opts) => { if (opts.redirect === 'manual') hopCalls++; throw new Error('must not be reached'); };
      const r = await runLink(link);
      check(`QA SSRF literal ${link} -> no hop`, hopCalls === 0, hopCalls);
      check(`QA SSRF literal ${link} -> danger with SSRF prefix`, r.status === 'danger' && r.details.startsWith('הקישור מפנה לכתובת רשת פרטית'), r);
      check(`QA SSRF literal ${link} -> heuristic highConfidence`, heuristicAnalysis(link, 'he').highConfidence === true);
    }
  }

  // --- 54. Public -> private redirect on a later hop: the private hop is
  // never requested, verdict is danger ---
  {
    for (const target of ['http://[::ffff:7f00:1]/latest/', 'http://100.100.100.200/', 'http://169.254.169.254/latest/meta-data/']) {
      const requested = [];
      global.fetch = async (url, opts) => {
        if (opts.redirect === 'manual') requested.push(url);
        if (url.startsWith('https://public-hop.example.com')) {
          return { status: 302, headers: { get: (h) => (h === 'location' ? target : null) } };
        }
        throw new Error('must not be reached');
      };
      const r = await runLink('https://public-hop.example.com/go');
      check(`QA redirect public->${target} -> danger`, r.status === 'danger', r);
      check(`QA redirect public->${target} -> private hop never requested`, requested.length === 1, requested);
    }
  }

  // --- 55. Things that are NOT private/raw IPs: domains that merely start
  // with digits or contain "localhost" are fetched normally and get no
  // private/IP verdict ---
  {
    for (const link of ['https://10.example.co.il/', 'https://127news.com/', 'https://localhost-tools.com/', 'https://ipv6.google.com/']) {
      let hopCalls = 0;
      const base = webRiskSafe;
      global.fetch = async (url, opts) => { if (opts.method === 'HEAD') hopCalls++; return base(url, opts); };
      const h = heuristicAnalysis(link, 'he');
      check(`QA not-an-IP ${link} -> no privateHost/publicIp signal`, !h.signals.includes('privateHost') && !h.signals.includes('publicIp'), h);
      check(`QA not-an-IP ${link} -> not highConfidence`, h.highConfidence === false, h);
      const r = await runLink(link);
      check(`QA not-an-IP ${link} -> hop was made`, hopCalls === 1, hopCalls);
      check(`QA not-an-IP ${link} -> not danger`, r.status !== 'danger', r);
    }
  }

  // --- 56. Domains built to look like an IP: suspicious score (uncertain),
  // never highConfidence/danger ---
  {
    global.fetch = webRiskSafe;
    for (const link of ['http://192.168.1.1.evil.com/', 'http://127.0.0.1.nip.io/']) {
      const h = heuristicAnalysis(link, 'he');
      check(`QA IP-like domain ${link} -> flagged, not safe`, h.signals.includes('ipLikeDomain') && h.verdict !== 'safe', h);
      check(`QA IP-like domain ${link} -> not highConfidence`, h.highConfidence === false, h);
      const r = await runLink(link);
      check(`QA IP-like domain ${link} -> handler uncertain`, r.status === 'uncertain', r);
    }
    // ...and when its DNS really points at loopback (nip.io), the
    // connect-time guard refuses it -- still uncertain, not danger.
    __setHopRequestForTests(null);
    __setConnectLookupForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
    const r = await runLink('http://127.0.0.1.nip.io/');
    check('QA 127.0.0.1.nip.io resolving to loopback -> refused, uncertain', r.status === 'uncertain' && r.details.startsWith('הקישור מפנה לכתובת רשת פרטית'), r);
    __setConnectLookupForTests(async () => [{ address: '10.0.0.5', family: 4 }, { address: 'fd00::1', family: 6 }]);
    const r2 = await runLink('https://public-name.example.com/');
    check('QA public name with A=10.0.0.5/AAAA=fd00::1 -> not safe, not danger', r2.status === 'uncertain', r2);
    __setConnectLookupForTests(null);
    __setHopRequestForTests(hopViaMockedFetch);
  }

  // --- 57. Raw IPs in any spelling -> danger + highConfidence ---
  {
    global.fetch = webRiskSafe;
    for (const link of ['http://203.0.113.5/', 'http://0xcb.0x0.0x71.0x5/', 'http://3405803781/', 'http://[2606:4700:4700::1111]/', 'http://[2001:db8::1]/', 'http://[::ffff:203.0.113.5]/']) {
      check(`QA raw IP ${link} -> highConfidence`, heuristicAnalysis(link, 'he').highConfidence === true);
      const r = await runLink(link);
      check(`QA raw IP ${link} -> danger`, r.status === 'danger', r);
    }
    const h = heuristicAnalysis('http://[2606:4700:4700::1111]/', 'he');
    check('QA public IPv6 -> publicIp, not privateHost', h.signals.includes('publicIp') && !h.signals.includes('privateHost'), h);
  }

  // --- 58. "@" only in userinfo -- including on an earlier redirect hop ---
  {
    global.fetch = webRiskSafe;
    for (const link of ['http://google.com@evil.com/', 'http://paypal.com:pw@evil.ru/', 'http://leumi.co.il@evil.co.il/']) {
      check(`QA userinfo ${link} -> highConfidence`, heuristicAnalysis(link, 'he').highConfidence === true);
      const r = await runLink(link);
      check(`QA userinfo ${link} -> danger`, r.status === 'danger', r);
    }
    for (const link of ['https://shop.example.com/unsubscribe?email=a@b.com', 'https://medium.com/@username/post-123', 'https://example.com/#contact@me']) {
      const h = heuristicAnalysis(link, 'he');
      check(`QA @ outside userinfo ${link} -> no atSign, not highConfidence`, !h.signals.includes('atSign') && h.highConfidence === false, h);
    }
    let r = await runLink('https://www.google.com/?email=a@b.com');
    check('QA google.com/?email=a@b.com -> safe', r.status === 'safe', r);
    r = await runLink('https://medium.com/@user');
    check('QA medium.com/@user -> not danger', r.status !== 'danger', r);

    // userinfo that would redirect to a clean site: never connected to, so
    // the redirect can't launder it -- still danger
    let hops = 0;
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD') {
        hops++;
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'https://clean-landing.example.com/' : null) } };
      }
      return webRiskSafe(url, opts);
    };
    r = await runLink('https://google.com@evil.example.com/x');
    check('QA userinfo + 302 to a clean site -> danger', r.status === 'danger' && r.details.includes('סימן @'), r);
    check('QA userinfo URL is never connected to', hops === 0, hops);

    // a raw public IP earlier in the chain, redirecting to a clean domain
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD' && url.startsWith('http://8.8.4.4')) {
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'https://clean-landing.example.com/' : null) } };
      }
      return webRiskSafe(url, opts);
    };
    r = await runLink('http://8.8.4.4/go');
    check('QA raw IP hop -> 302 to a clean domain -> still danger', r.status === 'danger' && r.details.includes('IP ציבורית'), r);
  }

  // --- 59. .il exemption by signal TYPE ---
  {
    global.fetch = webRiskSafe;
    for (const link of [
      'https://www.leumi.co.il/', 'https://login.bankhapoalim.co.il/', 'https://digital.isracard.co.il/', 'https://gov.il',
      'https://www.ynet.co.il/news/article/%D7%97%D7%93%D7%A9%D7%95%D7%AA-%D7%94%D7%99%D7%95%D7%9D',
      'http://www.mizrahi-catering.co.il/', 'https://superdiscount.co.il/', 'https://maccabi-tor.co.il/', 'https://10.example.co.il/',
    ]) {
      const r = await runLink(link);
      check(`QA .il legit ${link} -> safe`, r.status === 'safe', r);
    }
    const ynet = heuristicAnalysis('https://www.ynet.co.il/news/article/%D7%97%D7%93%D7%A9%D7%95%D7%AA-%D7%94%D7%99%D7%95%D7%9D', 'he');
    check('QA ynet Hebrew path -> no encoding / complexity signal', !ynet.signals.includes('suspiciousEncoding') && !ynet.signals.includes('urlComplexity'), ynet);
    for (const link of ['https://paypa1.co.il/', 'https://paypal.com.evil.co.il/', 'https://leumi-verify-account.co.il/login', 'https://leumi-verify.co.il/']) {
      const r = await runLink(link);
      check(`QA .il mimicry ${link} -> uncertain`, r.status === 'uncertain', r);
    }
    // A young .il domain (if RDAP ever covers .il) also loses the exemption.
    __setRdapFetchForTests(async () => ({ ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: new Date(Date.now() - 2 * 86400000).toISOString() }] }) }));
    const r = await runLink('http://www.brand-new-shop.co.il/');
    check('QA .il young domain -> uncertain', r.status === 'uncertain', r);
    __setRdapFetchForTests(makeFakeRdapFetch());
  }

  // --- 60. Redirect chain shape: >5 hops stops at exactly 5 requests and
  // caps at uncertain; a slow chain respects the budget; a shortener is
  // judged by its destination; a non-http Location ends the chain ---
  {
    let n = 0;
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD') { n++; return { status: 302, headers: { get: (h) => (h === 'location' ? `https://loop${n}.example.com/` : null) } }; }
      return webRiskSafe(url, opts);
    };
    let r = await runLink('https://loop0.example.com/');
    check('QA >5 redirects -> exactly 5 hops', n === 5, n);
    check('QA >5 redirects -> uncertain (never safe), not unknown', r.status === 'uncertain', r);

    __setRedirectBudgetForTests(200);
    let k = 0;
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD') {
        k++;
        await new Promise((res) => setTimeout(res, 100));
        return { status: 302, headers: { get: (h) => (h === 'location' ? `https://slow${k}.example.com/` : null) } };
      }
      return webRiskSafe(url, opts);
    };
    const t0 = Date.now();
    r = await runLink('https://slow0.example.com/');
    check('QA slow chain -> returns within budget + margin', Date.now() - t0 < 1000, Date.now() - t0);
    check('QA slow chain -> uncertain, not unknown', r.status === 'uncertain', r);
    __setRedirectBudgetForTests(null);

    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD' && url.startsWith('https://bit.ly/')) {
        return { status: 301, headers: { get: (h) => (h === 'location' ? 'http://paypa1-login.top/verify' : null) } };
      }
      return webRiskSafe(url, opts);
    };
    r = await runLink('https://bit.ly/abc');
    check('QA shortener -> judged at its destination (uncertain)', r.status === 'uncertain' && !r.details.includes('מקוצר'), r);

    const requested = [];
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD') {
        requested.push(url);
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'ftp://files.example.com/x' : null) } };
      }
      return webRiskSafe(url, opts);
    };
    r = await runLink('https://to-ftp.example.com/');
    check('QA non-http Location -> chain ends, ftp never requested', requested.length === 1, requested);
  }

  // --- 61. Web Risk "danger" stays danger whatever else is going on ---
  {
    const webRiskDanger = (url, opts) => ({ ok: true, json: async () => ({ threat: { threatTypes: ['SOCIAL_ENGINEERING'] } }) });
    for (const link of ['https://www.leumi.co.il/', 'https://medium.com/@user', 'https://10.example.co.il/']) {
      global.fetch = noRedirectFetch(webRiskDanger);
      const r = await runLink(link);
      check(`QA Web Risk danger wins: ${link}`, r.status === 'danger', r);
    }
    __setRedirectBudgetForTests(200);
    global.fetch = async (url, opts) => (opts.method === 'HEAD' ? new Promise(() => {}) : webRiskDanger(url, opts));
    const r = await runLink('https://stalls.example.com/');
    check('QA Web Risk danger wins even on an incomplete chain', r.status === 'danger', r);
    __setRedirectBudgetForTests(null);
  }

  // --- 62. QA review round 2: urgency only counts in the domain name, a
  // first-hop timeout isn't an "incomplete chain", randomHostname is weak ---
  {
    global.fetch = webRiskSafe;
    for (const link of ['https://www.superdiscount.co.il/account/orders', 'https://www.mizrahi-catering.co.il/login', 'http://www.shop4you2day.co.il/']) {
      const r = await runLink(link);
      check(`QA2 .il legit ${link} -> safe`, r.status === 'safe', r);
    }
    for (const link of ['https://leumi-verify.co.il/', 'https://secure-leumi.co.il/']) {
      const r = await runLink(link);
      check(`QA2 .il brand+urgent in hostname ${link} -> uncertain`, r.status === 'uncertain', r);
    }

    __setRedirectBudgetForTests(200);
    global.fetch = async (url, opts) => (opts.method === 'HEAD' ? new Promise(() => {}) : webRiskSafe(url, opts));
    let r = await runLink('https://www.leumi.co.il/');
    check('QA2 first hop stalls (geo-blocked bank) -> link itself checked, safe', r.status === 'safe', r);
    global.fetch = async (url, opts) => {
      if (opts.method === 'HEAD' && url.startsWith('https://bit.ly/')) {
        return { status: 302, headers: { get: (h) => (h === 'location' ? 'https://hop2.example.com/' : null) } };
      }
      return opts.method === 'HEAD' ? new Promise(() => {}) : webRiskSafe(url, opts);
    };
    r = await runLink('https://bit.ly/x');
    check('QA2 shortener -> 302 -> stalled hop -> uncertain', r.status === 'uncertain', r);
    __setRedirectBudgetForTests(null);

    // HEAD rejected with 405 -> the same hop is retried as GET
    const methods = [];
    global.fetch = async (url, opts) => {
      if (opts.redirect === 'manual') {
        methods.push(opts.method);
        if (opts.method === 'HEAD') return { status: 405, headers: { get: () => null } };
        return { status: 200, headers: { get: () => null } };
      }
      return webRiskSafe(url, opts);
    };
    r = await runLink('https://no-head.example.com/');
    check('QA2 HEAD 405 -> retried as GET on the same hop', methods.join(',') === 'HEAD,GET' && r.status === 'safe', { methods, r });
  }

  // --- 63. The real guardedHop (node:http request, header reading, absolute
  // timer) against a local server on 127.0.0.1 -- loopback only, no
  // external network. The guard itself would refuse 127.0.0.1, so these
  // pass a plain lookup; the guard's own refusal is covered in 50/56. ---
  {
    const http = await import('node:http');
    const plainLookup = (host, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      return opts && opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4);
    };
    let bodyReads = 0;
    const server = http.createServer((req, res) => {
      if (req.url === '/redirect') { res.writeHead(302, { Location: '/next' }); return res.end(); }
      if (req.url === '/no-head' && req.method === 'HEAD') { res.writeHead(405); return res.end(); }
      if (req.url === '/no-head') { res.writeHead(200); res.write('x'.repeat(65536)); bodyReads++; return; } // never ends
      if (req.url === '/hang') return; // never answers
      res.writeHead(200); res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://local-test.example:${server.address().port}`;

    let resp = await __guardedHopForTests(base + '/redirect', 'HEAD', 2000, plainLookup);
    check('guardedHop: reads status + Location', resp.status === 302 && resp.headers.get('Location') === '/next', resp.status);
    resp = await __guardedHopForTests(base + '/no-head', 'HEAD', 2000, plainLookup);
    check('guardedHop: HEAD 405 surfaced', resp.status === 405, resp.status);
    resp = await __guardedHopForTests(base + '/no-head', 'GET', 2000, plainLookup);
    check('guardedHop: GET returns on headers without waiting for an endless body', resp.status === 200 && bodyReads === 1, resp.status);

    const t0 = Date.now();
    let err = null;
    try { await __guardedHopForTests(base + '/hang', 'HEAD', 200, plainLookup); } catch (e) { err = e; }
    check('guardedHop: absolute timer fires on a silent server', err && err.code === 'EHOPTIMEOUT' && Date.now() - t0 < 1000, err && err.code);

    // And with the REAL guard wired in, the same local server is refused
    // before any connection (proves lookup is plumbed into the request).
    let hits = 0;
    server.on('request', () => { hits++; });
    __setConnectLookupForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
    err = null;
    try { await __guardedHopForTests(base + '/redirect', 'HEAD', 2000); } catch (e) { err = e; }
    check('guardedHop + guardedLookup: loopback refused with ESSRFBLOCKED', err && err.code === 'ESSRFBLOCKED', err && err.code);
    check('guardedHop + guardedLookup: server never received the request', hits === 0, hits);
    __setConnectLookupForTests(null);

    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }

  // --- 64. Web Risk sees the whole chain (security review A/B/C) ---
  {
    const webRiskUris = [];
    const webRiskListing = (listed) => async (url, opts) => {
      if (opts.redirect === 'manual') return null; // handled by the caller
      const uri = new URL(url).searchParams.get('uri');
      webRiskUris.push(uri);
      return { ok: true, json: async () => (listed.some((l) => uri.startsWith(l)) ? { threat: { threatTypes: ['SOCIAL_ENGINEERING'] } } : {}) };
    };
    const redirecting = (from, to, webRisk) => async (url, opts) => {
      if (opts.redirect === 'manual') {
        if (url.startsWith(from)) return { status: 302, headers: { get: (h) => (h === 'location' ? to : null) } };
        return { status: 200, headers: { get: () => null } };
      }
      return webRisk(url, opts);
    };

    // B: a listed URL that cloaks by redirecting us to google.com
    webRiskUris.length = 0;
    global.fetch = redirecting('https://listed-phish.example.com', 'https://www.google.com/', webRiskListing(['https://listed-phish.example.com']));
    let r = await runLink('https://listed-phish.example.com/login');
    check('WR chain: listed URL cloaking to google.com -> danger', r.status === 'danger', r);
    check('WR chain: both URLs were asked', webRiskUris.length === 2, webRiskUris);

    // B: a clean URL redirecting to a listed destination (as before)
    global.fetch = redirecting('https://clean-start.example.com', 'https://listed-dest.example.com/x', webRiskListing(['https://listed-dest.example.com']));
    r = await runLink('https://clean-start.example.com/');
    check('WR chain: clean start -> listed destination -> danger', r.status === 'danger', r);

    // B: no redirect -> exactly one Web Risk call
    webRiskUris.length = 0;
    global.fetch = redirecting('https://never-matches.invalid', '', webRiskListing([]));
    r = await runLink('https://www.google.com/');
    check('WR chain: no redirect -> exactly one Web Risk call', webRiskUris.length === 1 && r.status === 'safe', { webRiskUris, r });

    // B: the extra call fails, the final one is clean -> cautious
    // heuristic-only answer, same as a single failed call today
    global.fetch = redirecting('https://flaky-start.example.com', 'https://www.google.com/', async (url) => {
      if (new URL(url).searchParams.get('uri').startsWith('https://flaky-start')) throw new Error('simulated Web Risk failure');
      return { ok: true, json: async () => ({}) };
    });
    r = await runLink('https://flaky-start.example.com/');
    check('WR chain: one call failed -> treated as Web Risk unavailable', r.details.includes('בדיקה בסיסית'), r);

    // A: refused at connect (DNS points private) but the URL is listed -> danger
    __setHopRequestForTests(null);
    __setConnectLookupForTests(async () => [{ address: '127.0.0.1', family: 4 }]);
    global.fetch = webRiskListing(['http://listed-rebind.example.com']);
    r = await runLink('http://listed-rebind.example.com/');
    check('WR on SSRF path: DNS-private refusal + listed URL -> danger', r.status === 'danger' && r.details.includes('Google Web Risk'), r);
    global.fetch = webRiskListing([]);
    r = await runLink('http://unlisted-rebind.example.com/');
    check('WR on SSRF path: DNS-private refusal + not listed -> still uncertain', r.status === 'uncertain', r);
    global.fetch = async () => { throw new Error('simulated Web Risk outage'); };
    r = await runLink('http://outage-rebind.example.com/');
    check('WR on SSRF path: Web Risk down -> answer unchanged (uncertain)', r.status === 'uncertain' && r.details.startsWith('הקישור מפנה לכתובת רשת פרטית'), r);
    __setConnectLookupForTests(null);
    __setHopRequestForTests(hopViaMockedFetch);

    // A literal private host is already "danger": Web Risk isn't spent on it
    webRiskUris.length = 0;
    global.fetch = webRiskListing([]);
    r = await runLink('http://169.254.169.254/latest/meta-data/');
    check('WR on SSRF path: literal private -> danger without a Web Risk call', r.status === 'danger' && webRiskUris.length === 0, { r, webRiskUris });

    // C: raw public IP hop -> redirect to a host refused at connect -> danger
    global.fetch = async (url, opts) => {
      if (opts.redirect === 'manual') {
        if (url.startsWith('http://8.8.4.4')) return { status: 302, headers: { get: (h) => (h === 'location' ? 'http://rebind-after-ip.example.com/' : null) } };
        throw Object.assign(new Error('simulated connect-time refusal'), { ssrf: true, refusedAtConnect: true });
      }
      return { ok: true, json: async () => ({}) };
    };
    r = await runLink('http://8.8.4.4/go');
    check('SSRF path keeps an earlier raw-IP hop -> danger', r.status === 'danger' && r.details.includes('IP ציבורית'), r);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run();
