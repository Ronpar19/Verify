import { extractUrls } from './extractUrls.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// 1. Single explicit link inside a sentence -> isolated correctly
{
  const r = extractUrls('היי, קיבלת חבילה מוינה: http://bit.ly/abc123 נא לאשר בהקדם.');
  check('single http link isolated', r.length === 1 && r[0] === 'http://bit.ly/abc123', r);
}

// 2. Two explicit links in one message -> both found, in reading order
{
  const r = extractUrls('קישור ראשון: https://site-one.com/a ולינק שני: http://site-two.tk/b תודה');
  check('two links found', r.length === 2, r);
  check('order preserved', r[0] === 'https://site-one.com/a' && r[1] === 'http://site-two.tk/b', r);
}

// 3. Trailing punctuation is stripped
{
  const r = extractUrls('לחצו כאן: https://example.com/path.');
  check('trailing period stripped', r[0] === 'https://example.com/path', r);
}
{
  const r = extractUrls('קישור (https://example.com/path), עוד טקסט');
  check('trailing paren+comma stripped', r[0] === 'https://example.com/path', r);
}

// 4. www.-prefixed link without a scheme
{
  const r = extractUrls('בקרו ב-www.example-shop.com לפרטים');
  check('www-only link found', r.length === 1 && r[0] === 'www.example-shop.com', r);
}

// 5. Bare-domain fallback works when that's ALL there is (no scheme, no www)
{
  const r = extractUrls('amaz0n-verify-account.tk/secure/login');
  check('bare domain fallback works alone', r.length === 1 && r[0] === 'amaz0n-verify-account.tk/secure/login', r);
}

// 6. Bare-domain pattern should NOT add noise (e.g. an email's domain) once an explicit link exists
{
  const r = extractUrls('פנה ל-support@company.com או https://real-site.com/help לפרטים נוספים.');
  check('email domain not treated as a second link once a real link exists', r.length === 1 && r[0] === 'https://real-site.com/help', r);
}

// 7. The same link mentioned twice -> counted once
{
  const r = extractUrls('לחצו כאן https://dup.example.com/x ואם לא עבד, שוב: https://dup.example.com/x');
  check('duplicate link de-duplicated', r.length === 1, r);
}

// 8. No link at all
{
  const r = extractUrls('היי מה קורה, נדבר מחר בבוקר');
  check('no link -> empty array', r.length === 0, r);
}

// 9. Three links, mixed forms (scheme + www + scheme)
{
  const r = extractUrls('a: http://one.com b: www.two.com/x c: http://three.tk/y');
  check('three mixed-form links all found', r.length === 3, r);
  check('three mixed-form links in order', r[0] === 'http://one.com' && r[1] === 'www.two.com/x' && r[2] === 'http://three.tk/y', r);
}

// 10. Empty / whitespace-only / null input
{
  check('empty string -> []', extractUrls('').length === 0);
  check('whitespace-only -> []', extractUrls('   ').length === 0);
  check('null -> []', extractUrls(null).length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
