// scripts/smoke.mjs
//
// Post-deploy smoke test: asks the DEPLOYED backend about Google's own
// official Web Risk test URL and fails unless Web Risk really answered.
// This is the one check the offline suites can't do -- they mock Google --
// and it's the failure that went unnoticed in production: every answer
// silently fell back to "basic check only".
//
// Usage (never commit the secret; pass it through the environment):
//   SMOKE_API_URL=https://<backend>/api/check-link SMOKE_APP_SECRET=... node scripts/smoke.mjs
//
// Makes 2 requests (2 Web Risk lookups, 2 of the per-IP rate-limit budget).
// Exit code 0 = pass, 1 = a check failed, 2 = could not run.

const API_URL = process.env.SMOKE_API_URL;
const APP_SECRET = process.env.SMOKE_APP_SECRET || '';
const TIMEOUT_MS = 25000;

// Google's published, harmless test page for the MALWARE list.
const GOOGLE_TEST_URL = 'http://testsafebrowsing.appspot.com/s/malware.html';
const CLEAN_URL = 'https://www.google.com/';

if (!API_URL) {
  console.error('SMOKE_API_URL is not set (e.g. https://your-backend.vercel.app/api/check-link)');
  process.exit(2);
}

async function ask(link) {
  const started = Date.now();
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(APP_SECRET ? { 'x-app-secret': APP_SECRET } : {}) },
    body: JSON.stringify({ link, lang: 'en' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body = null;
  try { body = await resp.json(); } catch (e) { /* reported below as a bad answer */ }
  return { http: resp.status, body, ms: Date.now() - started };
}

let failed = 0;
function expect(name, ok, got) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '\n      got: ' + JSON.stringify(got)));
  if (!ok) failed++;
}

function explain(r) {
  if (r.http === 401) return 'The backend refused the request: SMOKE_APP_SECRET is missing or does not match APP_SECRET.';
  if (r.http === 429) return 'Rate limited: wait and run again (the limit is per IP, per hour).';
  if (r.body && r.body.webRisk === 'unavailable') {
    return 'Web Risk is NOT working on this deployment. Search the Vercel runtime logs for "check-link error (webrisk)":\n' +
      '      "GOOGLE_API_KEY is not set"        -> add it to the Production environment and redeploy\n' +
      '      "HTTP 400 ... API_KEY_INVALID"     -> wrong key value\n' +
      '      "HTTP 403 ... SERVICE_DISABLED"    -> enable "Web Risk API" in Google Cloud\n' +
      '      "HTTP 403 ... BILLING_DISABLED"    -> link a billing account to the project\n' +
      '      "HTTP 403 ... API_KEY_*_BLOCKED"   -> the key\'s restrictions block server calls / this API\n' +
      '      "HTTP 429"                         -> quota exhausted';
  }
  return '';
}

try {
  const bad = await ask(GOOGLE_TEST_URL);
  expect("Google's test URL -> HTTP 200", bad.http === 200, bad);
  expect("Google's test URL -> danger", !!bad.body && bad.body.status === 'danger', bad.body);
  expect('answer came from Web Risk (webRisk: ok)', !!bad.body && bad.body.webRisk === 'ok', bad.body);
  expect('no "Basic check only" fallback text', !!bad.body && typeof bad.body.details === 'string' && !/basic check only/i.test(bad.body.details), bad.body);
  const why = explain(bad);
  if (why) console.log('      ' + why);

  const good = await ask(CLEAN_URL);
  expect('clean URL -> HTTP 200', good.http === 200, good);
  expect('clean URL -> not danger, Web Risk consulted', !!good.body && good.body.status !== 'danger' && good.body.webRisk === 'ok', good.body);
  expect('clean URL -> no known threats (safe)', !!good.body && good.body.status === 'safe', good.body);

  console.log(`\ntimings: test URL ${bad.ms} ms, clean URL ${good.ms} ms`);
} catch (err) {
  console.error('Could not reach the backend:', (err && err.name) || 'error', (err && err.message) || '');
  process.exit(2);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nsmoke test passed');
process.exit(failed ? 1 : 0);
