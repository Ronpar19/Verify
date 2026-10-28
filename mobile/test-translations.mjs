import { LANGUAGES, STRINGS, DEFAULT_LANGUAGE, isRTL } from './translations.js';
import { getTermsBody } from './terms.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const CODES = LANGUAGES.map((l) => l.code);
const SOURCE = STRINGS[DEFAULT_LANGUAGE];
// Same text in every language on purpose (brand name).
const SAME_EVERYWHERE = ['appName'];

// 1. Every language in LANGUAGES has a STRINGS block, and vice versa
check('LANGUAGES and STRINGS list the same codes',
  CODES.slice().sort().join() === Object.keys(STRINGS).sort().join(),
  { LANGUAGES: CODES, STRINGS: Object.keys(STRINGS) });

// 2. RTL is set exactly for Hebrew and Arabic
for (const code of CODES) {
  check(`rtl flag correct for ${code}`, isRTL(code) === (code === 'he' || code === 'ar'));
}

// 3. Same keys in every language as the Hebrew source (no missing, no extra)
for (const code of CODES) {
  const keys = Object.keys(STRINGS[code] || {});
  const missing = Object.keys(SOURCE).filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !(k in SOURCE));
  check(`${code}: no missing keys`, missing.length === 0, missing);
  check(`${code}: no extra keys`, extra.length === 0, extra);
}

// 4. Same value type and shape per key; nothing empty; placeholders (function args) used
for (const code of CODES) {
  for (const [key, src] of Object.entries(SOURCE)) {
    const val = STRINGS[code][key];
    if (val === undefined) continue; // already reported in 3
    const where = `${code}.${key}`;
    if (typeof src === 'function') {
      check(`${where}: is a function`, typeof val === 'function');
      if (typeof val !== 'function') continue;
      check(`${where}: same number of params`, val.length === src.length, [val.length, src.length]);
      const args = Array.from({ length: src.length }, (_, i) => `ARG${i}`);
      const out = val(...args);
      check(`${where}: returns non-empty text`, typeof out === 'string' && out.trim() !== '', out);
      for (const a of args) check(`${where}: uses ${a}`, String(out).includes(a), out);
    } else if (Array.isArray(src)) {
      check(`${where}: is an array`, Array.isArray(val));
      if (!Array.isArray(val)) continue;
      check(`${where}: same length`, val.length === src.length, [val.length, src.length]);
      val.forEach((s, i) => check(`${where}[${i}]: non-empty`, typeof s === 'string' && s.trim() !== ''));
    } else {
      check(`${where}: is a string`, typeof val === 'string');
      check(`${where}: non-empty`, typeof val === 'string' && val.trim() !== '');
    }
  }
}

// 5. No leftover English in other languages (copy-paste not translated)
for (const code of CODES.filter((c) => c !== 'en')) {
  for (const [key, val] of Object.entries(STRINGS[code])) {
    if (SAME_EVERYWHERE.includes(key) || typeof val !== 'string') continue;
    check(`${code}.${key}: not identical to English`, val !== STRINGS.en[key], val);
  }
}

// 6. "No threat found" results must never promise the link is safe
const SAFE_WORDS = /\bsafe\b|sûrs?\b|безопасн|آمن|בטוח/i;
for (const code of CODES) {
  for (const key of ['safeTitle', 'multiSafe']) {
    const val = STRINGS[code][key];
    check(`${code}.${key}: does not claim "safe"`, typeof val === 'string' && !SAFE_WORDS.test(val), val);
  }
}

// 7. Terms: every language gets a non-empty body (Hebrew fallback is allowed for now)
for (const code of CODES) {
  const { text, isFallback } = getTermsBody(code);
  check(`terms ${code}: non-empty body`, typeof text === 'string' && text.trim() !== '');
  if (code === DEFAULT_LANGUAGE) check('terms he: is the original, not a fallback', isFallback === false);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
