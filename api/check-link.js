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
import psl from 'psl';
import punycode from 'punycode/punycode.js';
import { getRedis } from './_lib/redis.js';
import { recordCheck } from './_lib/stats.js';
import { infrastructureAnalysis } from './_lib/infrastructure.js';

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

// ---------- CORS origin allowlist ----------
//
// Only the deployed PWA needs a browser-level CORS allowance — the mobile
// app (Expo Go / installed native/EAS build) calls this directly with no
// browser involved, so CORS never applies to it regardless of this list.
// An Origin that matches neither pattern (or a request with no Origin
// header at all, e.g. a server-to-server call or curl) simply gets no
// Access-Control-Allow-Origin header — safe default, not an error.
//
// Deliberately NOT gated on NODE_ENV: mobile/.env points the web build's
// EXPO_PUBLIC_API_URL at this *deployed* backend even during local
// `expo start --web` (there's no local backend in that workflow), and
// Vercel sets NODE_ENV=production for every deployment of this function,
// Preview included — so an env-based check would silently block the local
// web dev origin (and Preview builds of the PWA) in the one place it
// actually runs. Matching on the origin string itself sidesteps that.
const ALLOWED_ORIGIN_PATTERNS = [
  // The deployed PWA (matches WEB_APP_URL in mobile/LinkCheckerScreen.js)
  // plus any Vercel Preview Deployment of it (verifyweb-<branch>.vercel.app).
  /^https:\/\/verifyweb(-[a-z0-9-]+)?\.vercel\.app$/i,
  // Local web dev (`expo start --web`), whatever port it lands on.
  /^http:\/\/localhost(:\d+)?$/i,
];

function corsOriginFor(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return null;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : null;
}

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
      typosquat: (brand) => `הדומיין דומה מאוד לדומיין הרשמי של ${brand} אך אינו זהה לו`,
      subdomainDecoy: (brand) => `הכתובת מכילה את "${brand}" כתת-דומיין מטעה — זה אינו הופך אותה לאתר הרשמי של ${brand}`,
      homoglyph: 'שם הדומיין מכיל תווים מאלפבית זר שנראים כמעט זהים לאותיות לטיניות — טכניקת הסוואה נפוצה',
      suspiciousEncoding: 'הכתובת מכילה קידוד תווים חריג שעלול להסתיר את תוכנה האמיתי',
      urlComplexity: 'מבנה הכתובת מורכב וארוך באופן חריג',
      randomHostname: 'שם המארח נראה אקראי באופן חריג',
      comboBonus: 'השילוב של כמה סימנים חשודים יחד תואם דפוס הונאה מוכר',
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
      typosquat: (brand) => `The domain closely resembles the official domain of ${brand} but is not the same`,
      subdomainDecoy: (brand) => `The address contains "${brand}" as a deceptive subdomain — this does not make it ${brand}'s official site`,
      homoglyph: 'The domain name contains characters from a different alphabet that look nearly identical to Latin letters — a common disguise technique',
      suspiciousEncoding: 'The address contains unusual character encoding that may be hiding its real content',
      urlComplexity: 'The URL structure is unusually long and complex',
      randomHostname: 'The hostname looks unusually random',
      comboBonus: 'The combination of several suspicious signals together matches a known phishing pattern',
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
      typosquat: (brand) => `Домен очень похож на официальный домен ${brand}, но не совпадает с ним`,
      subdomainDecoy: (brand) => `Адрес содержит «${brand}» в качестве обманного поддомена — это не делает его официальным сайтом ${brand}`,
      homoglyph: 'Имя домена содержит символы из другого алфавита, почти неотличимые от латинских букв — распространённый приём маскировки',
      suspiciousEncoding: 'Адрес содержит необычное кодирование символов, которое может скрывать его настоящее содержимое',
      urlComplexity: 'Структура ссылки необычно длинная и сложная',
      randomHostname: 'Имя хоста выглядит необычно случайным',
      comboBonus: 'Сочетание нескольких подозрительных признаков вместе соответствует известной схеме фишинга',
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
      typosquat: (brand) => `Le domaine ressemble fortement au domaine officiel de ${brand} sans être identique`,
      subdomainDecoy: (brand) => `L'adresse contient « ${brand} » comme sous-domaine trompeur — cela n'en fait pas le site officiel de ${brand}`,
      homoglyph: "Le nom de domaine contient des caractères d'un autre alphabet presque identiques à des lettres latines — une technique de camouflage courante",
      suspiciousEncoding: "L'adresse contient un encodage de caractères inhabituel qui pourrait dissimuler son contenu réel",
      urlComplexity: 'La structure du lien est anormalement longue et complexe',
      randomHostname: "Le nom d'hôte semble anormalement aléatoire",
      comboBonus: 'La combinaison de plusieurs signes suspects correspond à un schéma de phishing connu',
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
      typosquat: (brand) => `النطاق يشبه إلى حد كبير النطاق الرسمي لـ ${brand} لكنه ليس مطابقًا له`,
      subdomainDecoy: (brand) => `يحتوي العنوان على "${brand}" كنطاق فرعي مضلل — وهذا لا يجعله الموقع الرسمي لـ ${brand}`,
      homoglyph: 'يحتوي اسم النطاق على أحرف من أبجدية أخرى تبدو مطابقة تقريبًا لأحرف لاتينية — تقنية تمويه شائعة',
      suspiciousEncoding: 'يحتوي العنوان على ترميز أحرف غير معتاد قد يُخفي محتواه الحقيقي',
      urlComplexity: 'بنية الرابط طويلة ومعقدة بشكل غير معتاد',
      randomHostname: 'اسم المضيف يبدو عشوائيًا بشكل غير معتاد',
      comboBonus: 'يتطابق مزيج عدة علامات مشبوهة معًا مع نمط تصيّد احتيالي معروف',
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
  // explicitly allows it here. See corsOriginFor() above for the allowlist.
  const corsOrigin = corsOriginFor(req);
  if (corsOrigin) res.setHeader('Access-Control-Allow-Origin', corsOrigin);
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
  const webRiskPromise = apiKey
    ? checkWebRisk(finalUrl, apiKey, lang).catch((err) => {
        console.error('check-link error (webrisk):', err);
        return null; // fall through to heuristic-only below
      })
    : Promise.resolve(null);
  if (!apiKey) console.error('GOOGLE_API_KEY is not set in the environment');

  // Started concurrently with Web Risk -- both depend only on finalUrl and
  // have no dependency on each other. If Web Risk comes back "danger"
  // below, this promise is deliberately left unawaited (fire-and-forget):
  // a confirmed Web Risk "danger" already wins outright today regardless
  // of any other signal, so no infrastructure result could change that
  // outcome, and waiting for it would only add latency for nothing. On
  // Vercel serverless, once that early response is sent (no `waitUntil`
  // used to extend the instance's lifetime), this promise may or may not
  // get to finish before the instance freezes/recycles -- that's fine;
  // there's currently no Redis schema or consumer for a result that would
  // arrive after the response is already gone. (`waitUntil` from
  // `@vercel/functions` is confirmed to work on Vercel's Node.js
  // Serverless Functions, not just Edge -- it was evaluated and
  // deliberately not wired in for this same reason: nothing to do with
  // the result yet.)
  //
  // The `.catch()` here is a deliberate defensive backstop, not evidence
  // that infrastructureAnalysis() is known to reject today (it isn't --
  // every internal DNS/RDAP call is already individually guarded). But on
  // this fire-and-forget path nothing else will ever observe this promise
  // if it does throw, and on Node 24 an unhandled rejection crashes the
  // process outright, not just logs a warning (confirmed directly). A
  // future change to this file that adds an unguarded signal computation
  // should degrade gracefully here, not take down the whole request --
  // same reasoning, and the same pattern, as webRiskPromise's own
  // `.catch()` just above.
  const infraPromise = infrastructureAnalysis(finalUrl, lang).catch((err) => {
    console.error('check-link error (infra):', err);
    return { score: 0, reasons: [], available: false };
  });

  const webRiskResult = await webRiskPromise;

  // Web Risk found a confirmed match — that's a strong, reliable signal.
  // Trust it outright; no need for a second opinion from either the
  // heuristic or the infrastructure layer.
  if (webRiskResult && webRiskResult.status === 'danger') {
    return sendVerdict(req, res, webRiskResult.status, webRiskResult.details);
  }

  // By the time we reach here, infraPromise has already been running for
  // as long as webRiskPromise took (they started together), so this await
  // typically adds little to no extra wall-clock time on top of Web Risk's
  // own latency.
  const heuristic = heuristicAnalysis(finalUrl, lang);
  const infra = await infraPromise;

  // Combine into ONE score/reasons system, not a second verdict structure
  // (per design) -- the infrastructure layer's score is added to the
  // heuristic's own score and the verdict is re-derived using the exact
  // same thresholds heuristicAnalysis() itself uses internally.
  const combinedScore = heuristic.score + infra.score;
  const combinedReasons = [...heuristic.reasons, ...infra.reasons];
  const combinedVerdict = combinedScore >= 5 ? 'unsafe' : (combinedScore >= 2 ? 'uncertain' : 'safe');

  if (!webRiskResult) {
    // Web Risk unavailable (bad/missing key, network error, quota) — the
    // heuristic + infrastructure signals are all we have, so use the full
    // combined verdict range.
    const statusMap = { safe: 'safe', uncertain: 'uncertain', unsafe: 'danger' };
    return sendVerdict(req, res, statusMap[combinedVerdict], m.heuristicOnlyPrefix + combinedReasons.join('; '));
  }

  if (combinedVerdict === 'safe') {
    // All signals agree.
    return sendVerdict(req, res, 'safe', webRiskResult.details + m.bothSafeSuffix);
  }

  // Web Risk found nothing on its lists yet, but the heuristic caught a
  // pattern with essentially no legitimate use on the modern web (the
  // userinfo "@" trick, or a raw IP address standing in for a domain) —
  // that's high-confidence enough to call outright, without waiting for
  // Google to catch up. Weaker, more error-prone combinations (plain http
  // + a cheap TLD + a word like "login") do NOT get this treatment and
  // stay "uncertain" below, since those alone are common on legitimate
  // small/older sites too. The infrastructure layer NEVER sets this —
  // its independent DNS resolve can't guarantee it saw the same IP the
  // actual connection used (see api/_lib/infrastructure.js), so a private/
  // internal IP found only there stays a strong score contribution, never
  // an automatic "danger".
  if (heuristic.highConfidence) {
    return sendVerdict(req, res, 'danger', m.heuristicDangerPrefix + combinedReasons.join('; '));
  }

  // Everything else: Web Risk found nothing on its lists, and neither the
  // URL's own structure nor its infrastructure is a smoking gun — don't
  // hand out false confidence, but don't cry "danger" on a legitimate
  // site either.
  return sendVerdict(req, res, 'uncertain', m.uncertainPrefix + combinedReasons.join('; '));
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

// ---------- registrable-domain parsing (Public Suffix List, not naive split('.')) ----------
//
// A plain hostname.split('.') can't tell "amazon.com.evil.com" (owned by
// evil.com) apart from "login.amazon.com" (owned by amazon.com), and it
// gets multi-label TLDs like .co.il wrong. `psl` resolves the actual
// registrable domain the same way browsers do. Used only by the new
// typosquat/subdomain-decoy/homoglyph checks below — the existing
// isKnownSafe / brandImpersonation logic above is untouched on purpose
// (it already has correct, deliberate "any *.gov.il subdomain" semantics
// that a plain registrable-domain equality check would narrow).
function safePslParse(hostname) {
  try {
    const parsed = psl.parse(hostname);
    return parsed && !parsed.error ? parsed : null;
  } catch (e) {
    return null;
  }
}

// ---------- Levenshtein edit distance (typosquat detection) ----------

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Common number/letter substitutions used in typosquatting (paypa1, g00gle,
// micr0soft, faceb00k). Folded into typosquat detection rather than scored
// on its own -- a substitution alone means nothing (a brand could
// legitimately use a digit), it only matters when it makes a domain
// resemble one *specific* known brand.
const LEET_SUBSTITUTIONS = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function normalizeLeetSpeak(s) {
  let out = '';
  for (const ch of s) out += LEET_SUBSTITUTIONS[ch] || ch;
  return out;
}

// Compares a candidate registrable domain's second-level label against the
// well-known brands already trusted in KNOWN_SAFE_DOMAINS -- reusing that
// list rather than maintaining a second one. Only close, real near-misses
// are reported: a large length gap is rejected outright (cheap and avoids
// nonsense comparisons), and the exact real spelling is skipped (that's
// brandImpersonation's job below, e.g. "google.net").
function detectTyposquat(sld) {
  if (!sld || sld.length < 4) return null;
  const normalized = normalizeLeetSpeak(sld);
  let best = null;
  for (const officialDomain of KNOWN_SAFE_DOMAINS) {
    const officialSld = officialDomain.split('.')[0];
    if (officialSld.length < 4) continue; // e.g. "gov" (from gov.il) -- too short for edit-distance comparison to mean anything
    if (sld === officialSld) continue; // exact brand name, different TLD -- not a typo
    if (Math.abs(normalized.length - officialSld.length) > 2) continue;
    const distance = levenshteinDistance(normalized, officialSld);
    const maxDistance = officialSld.length <= 6 ? 1 : 2;
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { brand: officialDomain, distance };
    }
  }
  return best;
}

// Catches "paypal.com.evil.com": the real owner (evil.com) is fine on its
// own, but a well-known domain sitting in front of it as a fake subdomain
// is a classic deception with no legitimate use -- a real subdomain of
// evil.com would never spell out another company's entire domain.
// Correctly leaves "login.paypal.com" alone, since there registrableDomain
// IS paypal.com and the function returns null before comparing anything.
function detectBrandSubdomainDecoy(hostname, registrableDomain) {
  if (!registrableDomain || hostname === registrableDomain) return null;
  const suffix = '.' + registrableDomain;
  if (!hostname.endsWith(suffix)) return null;
  const subdomainPart = hostname.slice(0, hostname.length - suffix.length);
  for (const d of KNOWN_SAFE_DOMAINS) {
    if (subdomainPart === d || subdomainPart.endsWith('.' + d)) return d;
  }
  return null;
}

// ---------- Unicode homoglyph / mixed-script detection ----------
//
// The WHATWG URL parser already converts any non-ASCII hostname to
// punycode (new URL('http://аpple.com').hostname === 'xn--pple-43d.com'),
// which is why the existing punycode check (hostname.indexOf('xn--'))
// already catches IDN homograph attacks in a broad sense. This adds a
// *specific* reason for the common case -- Latin characters mixed with
// Cyrillic/Greek look-alikes -- by decoding back to Unicode and checking
// for that mix. A domain that's entirely non-Latin (a real Hebrew/Arabic/
// Cyrillic business name) is not flagged: only an actual *mix* of scripts
// within the brand-relevant labels is suspicious, so the always-ASCII TLD
// is excluded from the check, and a solely-non-Latin name is left alone.
// Scope limitation: covers Cyrillic + Greek confusables (by far the most
// common homograph pattern in the wild), not the full Unicode confusables
// table -- adding that would mean a large external dependency to catch
// scripts that essentially never appear in this kind of attack in practice.
const LATIN_LETTER_RE = /[a-z]/i;
const CONFUSABLE_SCRIPT_RE = /[Ѐ-ӿͰ-Ͽ]/;

function detectHomoglyph(hostnameAscii, parsedPsl) {
  if (hostnameAscii.indexOf('xn--') === -1) return false;
  let decoded;
  try { decoded = punycode.toUnicode(hostnameAscii); } catch (e) { return false; }
  if (decoded === hostnameAscii) return false;
  const tldLabelCount = parsedPsl && parsedPsl.tld ? parsedPsl.tld.split('.').length : 1;
  const decodedLabels = decoded.split('.');
  const brandLabels = decodedLabels.slice(0, Math.max(0, decodedLabels.length - tldLabelCount)).join('');
  return LATIN_LETTER_RE.test(brandLabels) && CONFUSABLE_SCRIPT_RE.test(brandLabels);
}

// ---------- URL encoding / obfuscation detection ----------
//
// Percent-encoding reserved/special characters (%20, %2C, %3D...) is
// completely normal -- redirect URLs routinely carry a whole encoded URL
// in a query parameter. What's NOT normal is encoding characters that
// never needed encoding in the first place (plain letters/digits, RFC
// 3986's "unreserved" set) -- legitimate URL generators simply don't do
// that, so any real amount of it is a strong, low-false-positive signal
// of deliberate obfuscation (e.g. %70%61%79%70%61%6C spelling "paypal").
function countUnnecessaryPercentEncoding(urlString) {
  const matches = urlString.match(/%[0-9a-fA-F]{2}/g) || [];
  let count = 0;
  for (const m of matches) {
    const ch = String.fromCharCode(parseInt(m.slice(1), 16));
    if (/[A-Za-z0-9._~-]/.test(ch)) count++;
  }
  return count;
}

function hasDoubleEncoding(urlString) {
  return /%25[0-9a-fA-F]{2}/i.test(urlString);
}

// %40 (@), %2F (/) and %2E (.) are specifically the delimiter characters
// that give a URL its structure -- encoding them is how an attacker hides
// e.g. a fake userinfo "@" or extra path segments from a human skimming
// the link. Scoped to the PATH only (never the query string), since a
// query parameter legitimately carrying an email address or an embedded
// redirect URL is exactly the common, harmless case that has these
// sequences too -- checking only the path avoids flagging that.
function hasEncodedDelimiterInPath(url) {
  return /%2f|%40|%2e/i.test(url.pathname);
}

// ---------- URL complexity (weak signal) ----------

function urlComplexityHits(url, rawUrl) {
  let hits = 0;
  if (rawUrl.length > 150) hits++;
  if (rawUrl.length > 350) hits++;
  if (url.pathname && url.pathname.length > 80) hits++;
  let paramCount = 0;
  try { paramCount = Array.from(url.searchParams.keys()).length; } catch (e) { /* malformed query, ignore */ }
  if (paramCount > 10) hits++;
  const dashCount = (url.hostname.match(/-/g) || []).length;
  if (dashCount >= 4) hits++;
  return hits;
}

// ---------- "looks randomly generated" hostname (weak signal) ----------
//
// Raw Shannon entropy on a short label turns out to be a noisy, unreliable
// discriminator on its own -- empirically, a readable phrase like
// "amaz0n-verify-account" scores *higher* than some genuinely random
// examples this was meant to catch. What actually separates them cleanly
// is vowel and digit density: real words/brand names are vowel-rich and
// essentially digit-free, while machine-generated hostnames
// (xj3k92ks8d92) are the opposite. Entropy is kept as a sanity floor on
// top of that, not the primary signal.
function shannonEntropy(s) {
  if (!s) return 0;
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function looksRandomHostname(label) {
  if (!label) return false;
  const alnum = label.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (alnum.length < 8) return false; // too short to judge reliably
  const digitRatio = (alnum.match(/[0-9]/g) || []).length / alnum.length;
  const vowelRatio = (alnum.match(/[aeiou]/g) || []).length / alnum.length;
  return shannonEntropy(alnum) >= 3.0 && (digitRatio >= 0.25 || vowelRatio <= 0.15);
}

// ---------- structural heuristic (second opinion / fallback) ----------
//
// Exported (not a __-prefixed test-only seam like the ones above -- this
// is a genuinely useful pure function) so tests can exercise the many
// signal combinations directly, the same way extractUrls.js is tested,
// instead of going through the full HTTP handler + fetch-mocking for
// every case.
export function heuristicAnalysis(rawUrl, lang) {
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
  let hitTld = false;
  if (SUSPICIOUS_TLDS.some((t) => hostname.slice(-t.length) === t)) {
    score += 2; reasons.push(r.suspiciousTld); hitTld = true;
  }
  if (hostname.indexOf('xn--') !== -1) {
    score += 3; reasons.push(r.punycode);
  }
  const subdomainParts = hostname.split('.').length - 2;
  if (subdomainParts >= 3) {
    score += 2; reasons.push(r.manySubdomains);
  }
  const isKnownSafe = KNOWN_SAFE_DOMAINS.some((d) => hostname === d || hostname.slice(-(d.length + 1)) === ('.' + d));
  let hitBrand = false;
  if (isKnownSafe) {
    score -= 3;
  } else {
    const hit = BRAND_KEYWORDS.find((b) => hostname.indexOf(b) !== -1);
    if (hit) {
      score += 3; reasons.push(r.brandImpersonation); hitBrand = true;
    }
  }
  const kc = URGENT_WORDS.filter((w) => full.indexOf(w) !== -1).length;
  let hitUrgent = false;
  if (kc >= 2) {
    score += 2; reasons.push(r.urgentWords); hitUrgent = true;
  }

  // ---------- new signals (see helper functions above for the "why") ----------
  // Skipped entirely for a known-safe domain -- there is nothing left to
  // typo-squat or impersonate once the registrable domain IS the real one.
  let hitEncoding = false, hitEntropy = false, hitComplexity = false;
  if (!isKnownSafe) {
    const parsedPsl = safePslParse(hostname);
    const registrableDomain = (parsedPsl && parsedPsl.domain) || hostname;

    const typosquat = parsedPsl ? detectTyposquat(parsedPsl.sld) : null;
    if (typosquat) {
      score += typosquat.distance === 0 ? 5 : typosquat.distance === 1 ? 4 : 3;
      reasons.push(r.typosquat(typosquat.brand));
      hitBrand = true;
    }

    const decoyBrand = detectBrandSubdomainDecoy(hostname, registrableDomain);
    if (decoyBrand) {
      score += 5; reasons.push(r.subdomainDecoy(decoyBrand)); hitBrand = true;
    }
  }

  if (detectHomoglyph(hostname, safePslParse(hostname))) {
    score += 4; reasons.push(r.homoglyph);
  }

  if (countUnnecessaryPercentEncoding(rawUrl) >= 3 || hasDoubleEncoding(rawUrl) || hasEncodedDelimiterInPath(url)) {
    score += 2; reasons.push(r.suspiciousEncoding); hitEncoding = true;
  }

  if (urlComplexityHits(url, rawUrl) >= 2) {
    score += Math.min(2, urlComplexityHits(url, rawUrl));
    reasons.push(r.urlComplexity); hitComplexity = true;
  }

  const sldForEntropy = (safePslParse(hostname) || {}).sld || hostname.split('.')[0];
  if (looksRandomHostname(sldForEntropy)) {
    score += 1; reasons.push(r.randomHostname); hitEntropy = true;
  }

  // ---------- signal-combination bonuses ----------
  //
  // Individual weak/moderate signals stay weak on their own -- but certain
  // combinations together match a well-known phishing pattern far more
  // specifically than their sum would suggest. Deliberately conservative:
  // capped total bonus, and (per design) a combo can never set
  // highConfidence itself -- only the three original patterns can, so a
  // pile of moderate signals still can't force a "danger" verdict past
  // Web Risk saying "safe"; it can only strengthen the heuristic-only
  // verdict (used when Web Risk itself is unavailable) and the reasons
  // shown to the user.
  let comboBonus = 0;
  // Brand mimicry + a cheap TLD + urgent wording ("verify your paypal-
  // login.top account now") -- the textbook phishing template.
  if (hitBrand && hitTld && hitUrgent) comboBonus += 2;
  // Brand mimicry riding on a randomized, over-complex URL -- looks like
  // an automatically-generated phishing kit rather than a hand-typed typo.
  if (hitBrand && hitEntropy && hitComplexity) comboBonus += 2;
  // Brand mimicry hidden behind obfuscated encoding.
  if (hitBrand && hitEncoding) comboBonus += 1;
  if (comboBonus > 0) {
    score += Math.min(3, comboBonus);
    reasons.push(r.comboBonus);
  }

  const verdict = score >= 5 ? 'unsafe' : (score >= 2 ? 'uncertain' : 'safe');
  if (!reasons.length) reasons.push(r.noneFound);
  // `score` is exposed (in addition to the pre-computed `verdict`) purely
  // so the handler can add the infrastructure layer's own score to it and
  // re-derive a verdict from the combined total using these exact same
  // thresholds — see infrastructureAnalysis() in api/_lib/infrastructure.js
  // and its caller below. Existing callers that only use `verdict` /
  // `reasons` / `highConfidence` (including every existing test) are
  // completely unaffected by this addition.
  return { verdict, reasons, highConfidence, score };
}
