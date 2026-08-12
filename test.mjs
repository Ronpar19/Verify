import handler, { __setRatelimiterForTests } from './api/check-link.js';
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

  // --- 17. A normal POST response carries the CORS header a browser needs
  // to accept the response (the mobile app ignores this header entirely,
  // it's browser-only enforcement) ---
  {
    global.fetch = noRedirectFetch(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler({ method: 'POST', body: { link: 'https://www.google.com' } }, res);
    check('CORS header present on a normal response', res._headers['Access-Control-Allow-Origin'] === '*', res);
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

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run();
