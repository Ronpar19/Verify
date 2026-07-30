import handler from './api/check-link.js';

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

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run();
