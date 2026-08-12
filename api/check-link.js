// api/check-link.js
//
// Secure serverless endpoint: POST { "link": "...", "lang": "he"|"en"|"ru"|"fr"|"ar" }
// -> { "status": "safe" | "danger" | "unknown", "details": "..." }
//
// The Google API key lives ONLY in process.env.GOOGLE_API_KEY (a Vercel
// environment variable) and is never sent to the mobile client.
//
// Two independent signals feed the verdict:
//   1. Google Web Risk — reliable, but only knows about *already known*
//      threats (a list lookup, not a live content analysis).
//   2. A local structural heuristic (domain/TLD/keyword patterns) — catches
//      some brand-new or not-yet-listed suspicious links that Web Risk
//      can't yet know about, and is also the fallback if Web Risk itself
//      is unavailable.
// Web Risk's "danger" always wins outright. Web Risk's "safe" gets a
// second opinion from the heuristic before being fully trusted.
//
// Multi-language: `lang` is optional. If omitted or not one of the 5
// supported codes, it defaults to Hebrew ('he') — the `he` block of
// MESSAGES below is kept byte-for-byte identical to the original
// (pre-i18n) Hebrew strings, so existing callers and existing tests are
// unaffected.

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './_lib/redis.js';
import { recordCheck } from './_lib/stats.js';

const THREAT_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'];
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 6000;

// Per-IP rate limit: protects the free Web Risk quota (100k calls/month)
// from a scraped/leaked endpoint URL being hammered. See README "Security
// notes" for the reasoning and the shared-IP (NAT/carrier) caveat.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = '1 h';

const SUPPORTED_LANGS = ['he', 'en', 'ru', 'fr', 'ar'];
const DEFAULT_LANG = 'he';

function resolveLang(raw) {
  return SUPPORTED_LANGS.includes(raw) ? raw : DEFAULT_LANG;
}

const MESSAGES = {
  he: {
    ssrfPrefix: 'הקישור מפנה לכתובת רשת פרטית/פנימית — חריג מאוד עבור קישור שנשלח אליך. ',
    genericError: 'לא הצלחנו לבדוק את הקישור כרגע, נסו שוב',
    unauthorized: 'הבקשה לא אושרה',
    rateLimited: 'קיבלנו יותר מדי בקשות ממכשיר זה בזמן קצר. נסו שוב בעוד קצת.',
    threatLabels: {
      MALWARE: 'תוכנה זדונית',
      SOCIAL_ENGINEERING: 'פישינג / הונאה',
      UNWANTED_SOFTWARE: 'תוכנה לא רצויה',
    },
    dangerWebRisk: (labels) => 'הקישור מזוהה כמסוכן על ידי Google Web Risk (' + labels + ')',
    safeWebRisk: 'לא נמצאו איומים ידועים בקישור זה לפי Google Web Risk',
    heuristicOnlyPrefix: '(בדיקה בסיסית בלבד — Google Web Risk לא היה זמין כרגע) ',
    bothSafeSuffix: ', וגם מבנה הקישור עצמו לא מעורר חשד',
    uncertainPrefix: 'לא נמצא ברשימות הידועות של Google, אך מבנה הקישור מעורר חשד: ',
    heuristicDangerPrefix: 'לא נמצא (עדיין) ברשימות הידועות של Google, אך מבנה הקישור תואם דפוס הונאה מוכר וודאי: ',
    heuristicReasons: {
      privateHost: 'הכתובת מפנה לרשת פרטית/פנימית — חריג מאוד עבור קישור שנשלח אליך',
      publicIp: 'הכתובת מפנה לכתובת IP ציבורית ולא לשם דומיין רגיל',
      atSign: 'נמצא סימן @ בכתובת — טכניקה נפוצה להסתרת היעד האמיתי',
      insecureHttp: 'החיבור אינו מוצפן (http ולא https)',
      shortener: 'הקישור מקוצר על ידי שירות חיצוני',
      suspiciousTld: 'סיומת הדומיין נפוצה באתרי הונאה',
      punycode: 'שם הדומיין מקודד בצורה שעלולה להסוות אותיות מטעות',
      manySubdomains: 'לדומיין יש תתי-דומיינים רבים באופן חריג',
      brandImpersonation: 'הדומיין מכיל שם של חברה מוכרת אך אינו הכתובת הרשמית שלה',
      urgentWords: 'הקישור מכיל מספר מילים שמעוררות תחושת דחיפות',
      noneFound: 'לא זוהו סימנים חשודים בולטים במבנה הקישור',
      parseFailed: 'לא הצלחנו לנתח את מבנה הכתובת',
    },
  },
  en: {
    ssrfPrefix: 'This link points to a private/internal network address — highly unusual for a link sent to you. ',
    genericError: 'We could not check this link right now, please try again',
    unauthorized: 'Request not authorized',
    rateLimited: 'Too many requests from this device in a short time. Please try again later.',
    threatLabels: {
      MALWARE: 'Malware',
      SOCIAL_ENGINEERING: 'Phishing / scam',
      UNWANTED_SOFTWARE: 'Unwanted software',
    },
    dangerWebRisk: (labels) => 'This link is flagged as dangerous by Google Web Risk (' + labels + ')',
    safeWebRisk: 'No known threats were found for this link by Google Web Risk',
    heuristicOnlyPrefix: '(Basic check only — Google Web Risk was unavailable) ',
    bothSafeSuffix: ", and the link's own structure is not suspicious either",
    uncertainPrefix: "Not found on Google's known lists, but the link's structure looks suspicious: ",
    heuristicDangerPrefix: "Not found on Google's known lists yet, but the link's structure matches a well-known, high-confidence scam pattern: ",
    heuristicReasons: {
      privateHost: 'The address points to a private/internal network — highly unusual for a link sent to you',
      publicIp: 'The address points to a public IP address rather than a normal domain name',
      atSign: 'An "@" sign was found in the address — a common technique to hide the real destination',
      insecureHttp: 'The connection is not encrypted (http, not https)',
      shortener: 'The link is shortened by an external service',
      suspiciousTld: 'This domain extension is common on scam sites',
      punycode: 'The domain name is encoded in a way that could disguise misleading characters',
      manySubdomains: 'The domain has an unusually large number of subdomains',
      brandImpersonation: 'The domain contains the name of a well-known company but is not its official address',
      urgentWords: 'The link contains several words that create a sense of urgency',
      noneFound: "No notable suspicious signs were detected in the link's structure",
      parseFailed: 'We could not parse the structure of this address',
    },
  },
  ru: {
    ssrfPrefix: 'Эта ссылка ведёт на частный/внутренний сетевой адрес — крайне необычно для ссылки, присланной вам. ',
    genericError: 'Не удалось проверить эту ссылку сейчас, попробуйте снова',
    unauthorized: 'Запрос не авторизован',
    rateLimited: 'Слишком много запросов с этого устройства за короткое время. Пожалуйста, повторите попытку позже.',
    threatLabels: {
      MALWARE: 'Вредоносное ПО',
      SOCIAL_ENGINEERING: 'Фишинг / мошенничество',
      UNWANTED_SOFTWARE: 'Нежелательное ПО',
    },
    dangerWebRisk: (labels) => 'Эта ссылка помечена как опасная сервисом Google Web Risk (' + labels + ')',
    safeWebRisk: 'Известных угроз для этой ссылки не найдено (по данным Google Web Risk)',
    heuristicOnlyPrefix: '(Только базовая проверка — Google Web Risk был недоступен) ',
    bothSafeSuffix: ', и структура самой ссылки также не вызывает подозрений',
    uncertainPrefix: 'Не найдено в известных списках Google, но структура ссылки выглядит подозрительно: ',
    heuristicDangerPrefix: 'Пока не найдено в известных списках Google, но структура ссылки соответствует хорошо известной, высокодостоверной схеме мошенничества: ',
    heuristicReasons: {
      privateHost: 'Адрес указывает на частную/внутреннюю сеть — крайне необычно для присланной вам ссылки',
      publicIp: 'Адрес указывает на публичный IP-адрес, а не на обычное доменное имя',
      atSign: 'В адресе найден символ "@" — распространённая техника скрытия настоящего адреса назначения',
      insecureHttp: 'Соединение не зашифровано (http, а не https)',
      shortener: 'Ссылка сокращена внешним сервисом',
      suspiciousTld: 'Это доменное расширение часто встречается на мошеннических сайтах',
      punycode: 'Доменное имя закодировано способом, который может маскировать вводящие в заблуждение символы',
      manySubdomains: 'У домена необычно много поддоменов',
      brandImpersonation: 'Домен содержит название известной компании, но не является её официальным адресом',
      urgentWords: 'Ссылка содержит несколько слов, создающих ощущение срочности',
      noneFound: 'Явных подозрительных признаков в структуре ссылки не обнаружено',
      parseFailed: 'Не удалось разобрать структуру этого адреса',
    },
  },
  fr: {
    ssrfPrefix: "Ce lien pointe vers une adresse réseau privée/interne — très inhabituel pour un lien qui vous a été envoyé. ",
    genericError: 'Impossible de vérifier ce lien pour le moment, veuillez réessayer',
    unauthorized: 'Requête non autorisée',
    rateLimited: 'Trop de requêtes depuis cet appareil en peu de temps. Veuillez réessayer plus tard.',
    threatLabels: {
      MALWARE: 'Logiciel malveillant',
      SOCIAL_ENGINEERING: 'Hameçonnage / arnaque',
      UNWANTED_SOFTWARE: 'Logiciel indésirable',
    },
    dangerWebRisk: (labels) => 'Ce lien est signalé comme dangereux par Google Web Risk (' + labels + ')',
    safeWebRisk: "Aucune menace connue n'a été trouvée pour ce lien par Google Web Risk",
    heuristicOnlyPrefix: '(Vérification de base uniquement — Google Web Risk était indisponible) ',
    bothSafeSuffix: ", et la structure du lien lui-même n'est pas non plus suspecte",
    uncertainPrefix: "Introuvable dans les listes connues de Google, mais la structure du lien semble suspecte : ",
    heuristicDangerPrefix: "Introuvable pour l'instant dans les listes connues de Google, mais la structure du lien correspond à un schéma d'arnaque bien connu et à haute confiance : ",
    heuristicReasons: {
      privateHost: "L'adresse pointe vers un réseau privé/interne — très inhabituel pour un lien qui vous a été envoyé",
      publicIp: "L'adresse pointe vers une adresse IP publique plutôt que vers un nom de domaine normal",
      atSign: "Un signe \"@\" a été trouvé dans l'adresse — une technique courante pour masquer la véritable destination",
      insecureHttp: "La connexion n'est pas chiffrée (http, pas https)",
      shortener: 'Le lien est raccourci par un service externe',
      suspiciousTld: 'Cette extension de domaine est courante sur les sites frauduleux',
      punycode: "Le nom de domaine est encodé d'une manière qui pourrait dissimuler des caractères trompeurs",
      manySubdomains: 'Le domaine comporte un nombre inhabituellement élevé de sous-domaines',
      brandImpersonation: "Le domaine contient le nom d'une entreprise connue mais n'est pas son adresse officielle",
      urgentWords: "Le lien contient plusieurs mots qui créent un sentiment d'urgence",
      noneFound: "Aucun signe suspect notable n'a été détecté dans la structure du lien",
      parseFailed: "Nous n'avons pas pu analyser la structure de cette adresse",
    },
  },
  ar: {
    ssrfPrefix: 'يشير هذا الرابط إلى عنوان شبكة خاص/داخلي — وهذا أمر غير معتاد جدًا لرابط أُرسل إليك. ',
    genericError: 'تعذّر فحص هذا الرابط الآن، يرجى المحاولة مرة أخرى',
    unauthorized: 'الطلب غير مصرح به',
    rateLimited: 'تلقينا عددًا كبيرًا جدًا من الطلبات من هذا الجهاز خلال وقت قصير. يرجى المحاولة مرة أخرى لاحقًا.',
    threatLabels: {
      MALWARE: 'برمجية خبيثة',
      SOCIAL_ENGINEERING: 'تصيّد احتيالي / احتيال',
      UNWANTED_SOFTWARE: 'برمجية غير مرغوب فيها',
    },
    dangerWebRisk: (labels) => 'تم وضع علامة على هذا الرابط بأنه خطير بواسطة Google Web Risk (' + labels + ')',
    safeWebRisk: 'لم يتم العثور على تهديدات معروفة لهذا الرابط وفقًا لـ Google Web Risk',
    heuristicOnlyPrefix: '(فحص أساسي فقط — لم تكن خدمة Google Web Risk متاحة) ',
    bothSafeSuffix: '، كما أن بنية الرابط نفسها لا تثير الشبهة',
    uncertainPrefix: 'لم يُعثر عليه في قوائم Google المعروفة، لكن بنية الرابط تثير الشبهة: ',
    heuristicDangerPrefix: 'لم يُعثر عليه بعد في قوائم Google المعروفة، لكن بنية الرابط تطابق نمط احتيال معروف وعالي الموثوقية: ',
    heuristicReasons: {
      privateHost: 'يشير العنوان إلى شبكة خاصة/داخلية — وهذا أمر غير معتاد جدًا لرابط أُرسل إليك',
      publicIp: 'يشير العنوان إلى عنوان IP عام بدلاً من اسم نطاق عادي',
      atSign: 'تم العثور على علامة "@" في العنوان — وهي تقنية شائعة لإخفاء الوجهة الحقيقية',
      insecureHttp: 'الاتصال غير مشفّر (http وليس https)',
      shortener: 'تم اختصار الرابط بواسطة خدمة خارجية',
      suspiciousTld: 'امتداد النطاق هذا شائع في مواقع الاحتيال',
      punycode: 'اسم النطاق مشفّر بطريقة قد تُخفي أحرفًا مضللة',
      manySubdomains: 'يحتوي النطاق على عدد كبير بشكل غير معتاد من النطاقات الفرعية',
      brandImpersonation: 'يحتوي النطاق على اسم شركة معروفة لكنه ليس عنوانها الرسمي',
      urgentWords: 'يحتوي الرابط على عدة كلمات تثير شعورًا بالإلحاح',
      noneFound: 'لم يتم رصد علامات مشبوهة واضحة في بنية الرابط',
      parseFailed: 'تعذّر تحليل بنية هذا العنوان',
    },
  },
};

// Basic SSRF guard: refuse to let the server fetch (directly, or via a
// redirect chain) anything pointing at loopback / private / link-local
// ranges. This is a literal-string check, not a DNS-resolution check —
// see README "Security notes" for the limitation.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/
];

const SHORTENERS = ['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','buff.ly','rebrand.ly','cutt.ly','shorte.st','tiny.cc','rb.gy','shorturl.at','t.ly'];
const SUSPICIOUS_TLDS = ['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.work','.loan','.win','.rest'];
const KNOWN_SAFE_DOMAINS = ['google.com','facebook.com','amazon.com','apple.com','microsoft.com','netflix.com','paypal.com','instagram.com','whatsapp.com','youtube.com','wikipedia.org','gov.il'];
const BRAND_KEYWORDS = ['paypal','amazon','microsoft','apple','google','facebook','netflix','bituach','bank','leumi','hapoalim','discount','mizrahi','postil','paybox'];
const URGENT_WORDS = ['verify','confirm','update','secure','suspended','urgent','login','password','account'];

// ---------- rate limiting (per IP, via Upstash Redis) ----------
//
// Lazily built once per warm serverless instance, and only if
// UPSTASH_REDIS_REST_URL/TOKEN are actually set — same graceful-
// degradation pattern as GOOGLE_API_KEY above: if it's not configured
// (local dev, or you haven't set it up yet), rate limiting is simply
// skipped rather than breaking every request.
let ratelimiterInstance; // undefined = not attempted yet, null = unavailable
let ratelimiterOverride = null; // test-only seam, see __setRatelimiterForTests

// Test-only hook: lets test.mjs inject a fake `{ limit(id) }` object so the
// 429 path (and the "allowed" path) can be exercised without a real Redis.
export function __setRatelimiterForTests(fakeLimiter) {
  ratelimiterOverride = fakeLimiter;
}

function getRatelimiter() {
  if (ratelimiterOverride) return ratelimiterOverride;
  if (ratelimiterInstance !== undefined) return ratelimiterInstance;

  const redis = getRedis();
  if (!redis) {
    console.error('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — rate limiting is disabled');
    ratelimiterInstance = null;
    return null;
  }

  ratelimiterInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
    analytics: false,
    prefix: 'verify-ratelimit',
  });
  return ratelimiterInstance;
}

function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  const real = req.headers && req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  return null;
}

// Returns { limited: false } to allow the request through — including when
// rate limiting isn't configured, the IP can't be determined, or Redis
// itself errors out (fail OPEN: a Redis hiccup should never break the app
// for a real user, same philosophy as the Web Risk fallback above).
async function checkRateLimit(req) {
  const limiter = getRatelimiter();
  if (!limiter) return { limited: false };

  const ip = clientIp(req);
  if (!ip) return { limited: false }; // never lump unresolvable IPs into one shared bucket

  try {
    const { success, reset } = await limiter.limit(ip);
    return { limited: !success, reset };
  } catch (err) {
    console.error('check-link error (ratelimit):', err);
    return { limited: false };
  }
}

// ---------- shared-secret check ----------
//
// Partial protection only: EXPO_PUBLIC_* values are inlined into the app
// bundle at build time, so anyone who unpacks the APK/web bundle can
// extract this value. It stops casual/accidental abuse (someone finding
// the bare endpoint URL), not a determined attacker. Skipped entirely if
// APP_SECRET isn't set on the server, same graceful-degradation pattern
// as everything else here.
function isAuthorized(req) {
  const expected = process.env.APP_SECRET;
  if (!expected) return true; // not configured -> don't enforce
  return req.headers && req.headers['x-app-secret'] === expected;
}

// ---------- usage counters (privacy-conscious, see api/_lib/stats.js) ----------
//
// Every completed check (any status, including "unknown") funnels through
// here so the counters and the actual response never drift apart. Never
// stores the checked link's content — only the resulting status and a
// salted hash of the IP for same-day dedup.
async function sendVerdict(req, res, status, details) {
  try {
    await recordCheck(getRedis(), { status, ip: clientIp(req) });
  } catch (err) {
    console.error('check-link error (stats):', err);
  }
  return res.status(200).json({ status, details });
}

export default async function handler(req, res) {
  // CORS: the mobile app (Expo Go / the installed native/EAS build) calls
  // this directly with no browser involved, so none of this applies to it.
  // The web/PWA version, though, runs inside an actual browser on its own
  // origin (e.g. verifyweb-*.vercel.app calling verifyapp-*.vercel.app) —
  // browsers block that cross-origin call by default unless the server
  // explicitly allows it here. The endpoint is already public/unauthenticated
  // by design (see README "Security notes"), so allowing any origin doesn't
  // change its risk profile.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');

  // Browsers send an OPTIONS "preflight" request before the real POST for
  // any cross-origin request with a JSON body — answer it directly instead
  // of falling through to the 405 below, or the actual POST never happens.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'unknown', details: 'Method not allowed' });
  }

  const { link, lang: rawLang } = req.body || {};
  const lang = resolveLang(rawLang);
  const m = MESSAGES[lang];

  if (!isAuthorized(req)) {
    return res.status(401).json({ status: 'unknown', details: m.unauthorized });
  }

  const rateLimit = await checkRateLimit(req);
  if (rateLimit.limited) {
    if (rateLimit.reset) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000)));
    }
    return res.status(429).json({ status: 'unknown', details: m.rateLimited });
  }

  if (!link || typeof link !== 'string' || !link.trim()) {
    return res.status(400).json({ status: 'unknown', details: 'Missing "link" in request body' });
  }

  let finalUrl;
  try {
    const normalized = normalizeUrl(link.trim());
    finalUrl = await resolveFinalUrl(normalized);
  } catch (err) {
    console.error('check-link error (resolve):', err);
    if (err && err.ssrf) {
      // We won't fetch a private/internal address (SSRF guard), but a link
      // pointing at one is itself a strong, useful signal — surface it
      // instead of a content-free "unknown".
      const heuristic = heuristicAnalysis(err.attemptedUrl, lang);
      const statusMap = { safe: 'uncertain', uncertain: 'uncertain', unsafe: 'danger' };
      return sendVerdict(req, res, statusMap[heuristic.verdict] || 'uncertain', m.ssrfPrefix + heuristic.reasons.join('; '));
    }
    return sendVerdict(req, res, 'unknown', m.genericError);
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  let webRiskResult = null;
  if (apiKey) {
    try {
      webRiskResult = await checkWebRisk(finalUrl, apiKey, lang);
    } catch (err) {
      console.error('check-link error (webrisk):', err);
      webRiskResult = null; // fall through to heuristic-only below
    }
  } else {
    console.error('GOOGLE_API_KEY is not set in the environment');
  }

  // Web Risk found a confirmed match — that's a strong, reliable signal.
  // Trust it outright; no need for a second opinion.
  if (webRiskResult && webRiskResult.status === 'danger') {
    return sendVerdict(req, res, webRiskResult.status, webRiskResult.details);
  }

  const heuristic = heuristicAnalysis(finalUrl, lang);

  if (!webRiskResult) {
    // Web Risk unavailable (bad/missing key, network error, quota) — the
    // heuristic is the only signal we have, so use its full verdict range.
    const statusMap = { safe: 'safe', uncertain: 'uncertain', unsafe: 'danger' };
    return sendVerdict(req, res, statusMap[heuristic.verdict], m.heuristicOnlyPrefix + heuristic.reasons.join('; '));
  }

  if (heuristic.verdict === 'safe') {
    // Both signals agree.
    return sendVerdict(req, res, 'safe', webRiskResult.details + m.bothSafeSuffix);
  }

  // Web Risk found nothing on its lists yet, but the heuristic caught a
  // pattern with essentially no legitimate use on the modern web (the
  // userinfo "@" trick, or a raw IP address standing in for a domain) —
  // that's high-confidence enough to call outright, without waiting for
  // Google to catch up. Weaker, more error-prone combinations (plain http
  // + a cheap TLD + a word like "login") do NOT get this treatment and
  // stay "uncertain" below, since those alone are common on legitimate
  // small/older sites too.
  if (heuristic.highConfidence) {
    return sendVerdict(req, res, 'danger', m.heuristicDangerPrefix + heuristic.reasons.join('; '));
  }

  // Everything else: Web Risk found nothing on its lists, and the URL's
  // own structure looks suspicious but isn't a smoking gun — don't hand
  // out false confidence, but don't cry "danger" on a legitimate site
  // either.
  return sendVerdict(req, res, 'uncertain', m.uncertainPrefix + heuristic.reasons.join('; '));
}

function normalizeUrl(raw) {
  return /^https?:\/\//i.test(raw) ? raw : 'http://' + raw;
}

function safeHostname(urlString) {
  try { return new URL(urlString).hostname; } catch (e) { return null; }
}

function isPrivateHost(hostname) {
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname));
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Follows redirects manually (HEAD, falling back to GET if a server
// rejects HEAD) so shortened links (bit.ly, tinyurl, ...) get checked at
// their real destination instead of at the shortener's own domain.
async function resolveFinalUrl(startUrl) {
  let current = startUrl;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const hostname = safeHostname(current);
    if (!hostname || isPrivateHost(hostname)) {
      const blocked = new Error('Refusing to follow a redirect to a private/internal address');
      blocked.ssrf = true;
      blocked.attemptedUrl = current;
      throw blocked;
    }

    let response;
    try {
      response = await fetchWithTimeout(current, { method: 'HEAD', redirect: 'manual' });
      if (response.status === 405) {
        response = await fetchWithTimeout(current, { method: 'GET', redirect: 'manual' });
      }
    } catch (e) {
      break; // network error or timeout — check whatever URL we have so far
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      try {
        current = new URL(location, current).toString();
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }
  return current;
}

async function checkWebRisk(url, apiKey, lang) {
  const m = MESSAGES[lang];
  const endpoint = new URL('https://webrisk.googleapis.com/v1/uris:search');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('uri', url);
  THREAT_TYPES.forEach((t) => endpoint.searchParams.append('threatTypes', t));

  const resp = await fetchWithTimeout(endpoint.toString(), { method: 'GET' });

  if (!resp.ok) {
    throw new Error('Web Risk API responded with status ' + resp.status);
  }

  const data = await resp.json();

  // Per Google's docs: if the URI is not found on any requested threat
  // list, the API returns an EMPTY object ({}) — that's the "safe" case.
  if (data && data.threat && Array.isArray(data.threat.threatTypes) && data.threat.threatTypes.length > 0) {
    return {
      status: 'danger',
      details: m.dangerWebRisk(translateThreatTypes(data.threat.threatTypes, lang))
    };
  }

  return { status: 'safe', details: m.safeWebRisk };
}

function translateThreatTypes(types, lang) {
  const labels = MESSAGES[lang].threatLabels;
  return types.map((t) => labels[t] || t).join(', ');
}

// ---------- structural heuristic (second opinion / fallback) ----------

function heuristicAnalysis(rawUrl, lang) {
  const m = MESSAGES[lang];
  const r = m.heuristicReasons;
  const reasons = [];
  let score = 0;
  // True only for patterns that have essentially no legitimate use in a
  // link sent to an end user (the userinfo "@" trick, a raw IP address
  // standing in for a domain, or a private/internal address) — strong
  // enough to call "danger" outright even without Web Risk's confirmation.
  // Weaker signals (plain http, a cheap TLD, urgent wording) never set
  // this, however high their combined score gets, since those alone are
  // common on legitimate small/older sites too.
  let highConfidence = false;
  const hadProtocol = /^https?:\/\//i.test(rawUrl);
  const toParse = hadProtocol ? rawUrl : 'http://' + rawUrl;

  let url;
  try { url = new URL(toParse); }
  catch (e) { return { verdict: 'uncertain', reasons: [r.parseFailed], highConfidence: false }; }

  const hostname = url.hostname.toLowerCase();
  const full = rawUrl.toLowerCase();

  if (isPrivateHost(hostname)) {
    score += 6; reasons.push(r.privateHost); highConfidence = true;
  } else if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    score += 4; reasons.push(r.publicIp); highConfidence = true;
  }
  if (rawUrl.indexOf('@') !== -1 && !/^mailto:/i.test(rawUrl)) {
    score += 5; reasons.push(r.atSign); highConfidence = true;
  }
  if (url.protocol === 'http:') {
    score += 1; reasons.push(r.insecureHttp);
  }
  if (SHORTENERS.some((s) => hostname === s || hostname.slice(-(s.length + 1)) === ('.' + s))) {
    score += 2; reasons.push(r.shortener);
  }
  if (SUSPICIOUS_TLDS.some((t) => hostname.slice(-t.length) === t)) {
    score += 2; reasons.push(r.suspiciousTld);
  }
  if (hostname.indexOf('xn--') !== -1) {
    score += 3; reasons.push(r.punycode);
  }
  const subdomainParts = hostname.split('.').length - 2;
  if (subdomainParts >= 3) {
    score += 2; reasons.push(r.manySubdomains);
  }
  const isKnownSafe = KNOWN_SAFE_DOMAINS.some((d) => hostname === d || hostname.slice(-(d.length + 1)) === ('.' + d));
  if (isKnownSafe) {
    score -= 3;
  } else {
    const hit = BRAND_KEYWORDS.find((b) => hostname.indexOf(b) !== -1);
    if (hit) {
      score += 3; reasons.push(r.brandImpersonation);
    }
  }
  const kc = URGENT_WORDS.filter((w) => full.indexOf(w) !== -1).length;
  if (kc >= 2) {
    score += 2; reasons.push(r.urgentWords);
  }

  const verdict = score >= 5 ? 'unsafe' : (score >= 2 ? 'uncertain' : 'safe');
  if (!reasons.length) reasons.push(r.noneFound);
  return { verdict, reasons, highConfidence };
}
