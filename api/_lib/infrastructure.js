// api/_lib/infrastructure.js
//
// DNS / infrastructure risk layer -- deliberately a SEPARATE module from
// the structural heuristic in api/check-link.js, per the design brief:
// this layer looks at where a domain's *infrastructure* actually points
// (DNS records, IP classification, registration age via RDAP), not at the
// URL's own text/structure. It returns signals meant to fold into the
// existing score/reasons system (see infrastructureAnalysis() below) --
// it is NOT a second, separate verdict system.
//
// Unlike the structural heuristic, this layer DOES make real network
// calls (DNS resolution, RDAP) -- that's the whole point of it. What it
// deliberately does NOT do is call any paid/commercial reputation service
// (VirusTotal, WHOIS-as-a-service, AbuseIPDB, ASN databases, etc.) -- see
// asnLookup() below for where that line is drawn.

import dns from 'node:dns';
import ipaddr from 'ipaddr.js';
import psl from 'psl';

const dnsPromises = dns.promises;

// ---------- timeouts / budget ----------
//
// Each individual lookup gets its own short timeout so one slow resolver
// can't stall the others (they all run concurrently). The whole layer is
// additionally capped by an overall deadline as a backstop -- in the
// normal case every sub-lookup already finishes well under this since
// they run in parallel, not in series.
const DNS_LOOKUP_TIMEOUT_MS = 600;
const RDAP_TIMEOUT_MS = 900;
const LAYER_BUDGET_MS = 1800;

// ---------- test-only injection seams ----------
//
// Same pattern as api/_lib/redis.js's __setRedisForTests: lets test.mjs
// swap in fake DNS/RDAP implementations so tests are fast, deterministic,
// and make no real network calls -- consistent with how the rest of this
// project's test suite works (mocked fetch, no live API calls).
let dnsOverride = null;
let rdapFetchOverride = null;

export function __setDnsForTests(fakeDns) {
  dnsOverride = fakeDns;
}
export function __setRdapFetchForTests(fakeFetch) {
  rdapFetchOverride = fakeFetch;
}

function getDns() {
  return dnsOverride || dnsPromises;
}
function getRdapFetch() {
  return rdapFetchOverride || fetch;
}

// ---------- per-language reason strings ----------
//
// Kept self-contained in this module (not merged into check-link.js's
// MESSAGES) so this layer stays genuinely independent and testable on
// its own, per the "separate and clear from the heuristic" brief.
const INFRA_MESSAGES = {
  he: {
    privateIpDestination: 'הכתובת שאליה הדומיין מפנה בפועל (DNS) היא כתובת רשת פרטית/פנימית — חריג מאוד עבור אתר ציבורי',
    veryNewDomain: (days) => `הדומיין נרשם לאחרונה מאוד (לפני כ-${days} ימים)`,
    newDomain: (days) => `הדומיין נרשם לאחרונה יחסית (לפני כ-${days} ימים)`,
  },
  en: {
    privateIpDestination: "The domain's actual DNS destination is a private/internal network address — highly unusual for a public site",
    veryNewDomain: (days) => `The domain was registered very recently (about ${days} days ago)`,
    newDomain: (days) => `The domain was registered relatively recently (about ${days} days ago)`,
  },
  ru: {
    privateIpDestination: 'Фактический DNS-адрес домена указывает на частную/внутреннюю сеть — крайне необычно для публичного сайта',
    veryNewDomain: (days) => `Домен был зарегистрирован совсем недавно (примерно ${days} дн. назад)`,
    newDomain: (days) => `Домен был зарегистрирован относительно недавно (примерно ${days} дн. назад)`,
  },
  fr: {
    privateIpDestination: "La destination DNS réelle du domaine est une adresse réseau privée/interne — très inhabituel pour un site public",
    veryNewDomain: (days) => `Le domaine a été enregistré très récemment (il y a environ ${days} jours)`,
    newDomain: (days) => `Le domaine a été enregistré relativement récemment (il y a environ ${days} jours)`,
  },
  ar: {
    privateIpDestination: 'الوجهة الفعلية للدومين عبر DNS هي عنوان شبكة خاص/داخلي — أمر غير معتاد جدًا لموقع عام',
    veryNewDomain: (days) => `تم تسجيل الدومين مؤخرًا جدًا (منذ حوالي ${days} يومًا)`,
    newDomain: (days) => `تم تسجيل الدومين مؤخرًا نسبيًا (منذ حوالي ${days} يومًا)`,
  },
};

// ---------- IP classification (ipaddr.js) ----------
//
// ipaddr.js correctly folds in the tricky cases a hand-rolled regex tends
// to miss -- IPv4-mapped IPv6 (::ffff:127.0.0.1 normalizes to loopback),
// unique-local IPv6 (fc00::/7), link-local IPv6 (fe80::/10), etc.
function isNonPublicIp(ipString) {
  try {
    const addr = ipaddr.process(ipString); // process() also unwraps IPv4-mapped IPv6
    return addr.range() !== 'unicast';
  } catch (e) {
    return false; // unparsable -- not our job to flag, just don't crash
  }
}

// ---------- single lookup with its own timeout ----------

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ __timedOut: true }), ms)),
  ]);
}

// ---------- DNS resolution ----------
//
// *** TOCTOU / DNS-rebinding caveat, read before touching this function ***
// This resolve is INDEPENDENT of the one resolveFinalUrl()'s fetch() will
// perform (or already performed) to actually reach the host -- there is a
// real, if narrow, window in which a domain could answer differently
// between the two (a very low DNS TTL is exactly how "DNS rebinding"
// attacks work). This function is called once, as close in time to actual
// use as the code structure allows, specifically to keep that window as
// short as practical -- but it is NOT a proof of what resolveFinalUrl's
// own connection actually hit. That's why any private/internal IP found
// here MUST NOT set highConfidence (see heuristicAnalysis's caller in
// check-link.js) -- only resolveFinalUrl's own pre-connection SSRF guard
// (which stops the flow before any connection is attempted, a real
// guarantee) is allowed to do that.
// NS records only ever exist at a zone's delegation point (in practice,
// the registrable domain), never at an arbitrary hostname within it --
// confirmed empirically while building this: querying NS for
// "www.google.com" comes back empty even though google.com itself has
// four NS records, because "www" isn't a delegation point. NS is
// therefore queried against `registrableDomain`, not `hostname`; every
// other record type is queried at the actual hostname being visited.
async function resolveDnsRecords(hostname, registrableDomain) {
  const d = getDns();
  const [a, aaaa, cname, mx, ns] = await Promise.all([
    withTimeout(d.resolve4(hostname).catch(() => []), DNS_LOOKUP_TIMEOUT_MS),
    withTimeout(d.resolve6(hostname).catch(() => []), DNS_LOOKUP_TIMEOUT_MS),
    withTimeout(d.resolveCname(hostname).catch(() => []), DNS_LOOKUP_TIMEOUT_MS),
    withTimeout(d.resolveMx(hostname).catch(() => []), DNS_LOOKUP_TIMEOUT_MS),
    withTimeout(d.resolveNs(registrableDomain || hostname).catch(() => []), DNS_LOOKUP_TIMEOUT_MS),
  ]);
  const clean = (v) => (v && v.__timedOut ? [] : v);
  return { a: clean(a), aaaa: clean(aaaa), cname: clean(cname), mx: clean(mx), ns: clean(ns) };
}

// ---------- domain age via RDAP ----------
//
// RDAP coverage is genuinely uneven across registries -- verified before
// building this: gTLDs (.com/.org/.net/...) resolve reliably via the
// rdap.org bootstrap (tested: google.com -> 200 OK in ~570ms with a
// correct registration date). .il is NOT in IANA's RDAP bootstrap
// registry at all (confirmed directly against data.iana.org/rdap/dns.json
// -- gov.il itself 404s, not a fluke). This is not a bug to work around;
// per the design brief, "no data" for an unsupported TLD is the expected,
// silent outcome, not a suspicious signal.
async function domainAgeDays(registrableDomain) {
  if (!registrableDomain) return null;
  const rdapFetch = getRdapFetch();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
    let resp;
    try {
      resp = await rdapFetch('https://rdap.org/domain/' + registrableDomain, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp || !resp.ok) return null;
    const data = await resp.json();
    const events = Array.isArray(data && data.events) ? data.events : [];
    const registration = events.find((e) => e.eventAction === 'registration');
    if (!registration || !registration.eventDate) return null;
    const registeredAt = new Date(registration.eventDate);
    if (isNaN(registeredAt.getTime())) return null;
    return Math.floor((Date.now() - registeredAt.getTime()) / 86400000);
  } catch (e) {
    return null; // timeout, network error, unsupported TLD, malformed response -- all the same "no data" outcome
  }
}

// ---------- ASN / hosting infrastructure ----------
//
// Deliberately NOT implemented. A reliable ASN lookup needs either a
// downloaded IP-to-ASN database (e.g. MaxMind GeoLite2 ASN -- tens of MB,
// needs periodic updates, not really "local and computational" in the
// same sense as everything else here) or an external paid/commercial
// service (explicitly out of scope for this phase). There's a free
// DNS-based option (Team Cymru's origin.asn.cymru.com TXT lookup) that
// was considered and deliberately deferred -- it depends on an unofficial
// third-party community service with no IANA-backed guarantee, similar in
// kind to the .il RDAP gap found above, and ASN alone is only ever
// supposed to be weak context per the design brief anyway. Left as an
// explicit placeholder with a clear signature so it can be filled in
// later without reshaping anything that calls it.
export async function asnLookup(domain) {
  return null;
}

// ---------- main entry point ----------

export async function infrastructureAnalysis(finalUrl, lang) {
  const m = INFRA_MESSAGES[lang] || INFRA_MESSAGES.he;
  const reasons = [];
  let score = 0;

  const work = (async () => {
    let hostname;
    try {
      hostname = new URL(finalUrl).hostname.toLowerCase();
    } catch (e) {
      return { score: 0, reasons: [], available: false };
    }

    const parsedPsl = (() => { try { const p = psl.parse(hostname); return p && !p.error ? p : null; } catch (e) { return null; } })();
    const registrableDomain = (parsedPsl && parsedPsl.domain) || hostname;

    const [dnsRecords, ageDays] = await Promise.all([
      resolveDnsRecords(hostname, registrableDomain),
      domainAgeDays(registrableDomain),
    ]);

    // ---- infrastructure signal: private/internal IP behind a public hostname ----
    // See the TOCTOU comment on resolveDnsRecords()/this file's header --
    // strong signal, deliberately never highConfidence.
    const allIps = [...dnsRecords.a, ...dnsRecords.aaaa];
    if (allIps.some(isNonPublicIp)) {
      score += 5;
      reasons.push(m.privateIpDestination);
    }

    // NOTE on nameservers: originally scored "address records present but
    // zero NS records" as a weak anomaly signal. Dropped after live
    // testing surfaced a real DNS resolver returning ENODATA for
    // google.com's own NS records (confirmed correct via a different
    // resolver -- google.com does have four) -- some resolver
    // environments just don't reliably answer NS queries, for reasons
    // that have nothing to do with the domain being checked. A signal
    // that can false-positive on google.com is unacceptable, and there's
    // no way to guarantee Vercel's own resolver behaves better. NS data
    // is still captured below for context/future use, just never scored.

    // ---- domain age (only when RDAP actually had data -- see domainAgeDays) ----
    // Weak/moderate on purpose, per the design brief: a new domain alone
    // is not phishing (a legitimate business launches new domains too).
    if (ageDays !== null && ageDays >= 0) {
      if (ageDays < 7) {
        score += 3;
        reasons.push(m.veryNewDomain(ageDays));
      } else if (ageDays < 30) {
        score += 1;
        reasons.push(m.newDomain(ageDays));
      }
    }

    // MX and CNAME are deliberately not scored on their own (see design
    // brief section 7: "no MX" is not a phishing signal by itself), but
    // are returned for context / potential future combination signals.
    return {
      score,
      reasons,
      available: true,
      mx: dnsRecords.mx,
      cname: dnsRecords.cname,
      ns: dnsRecords.ns,
      ageDays,
    };
  })();

  const result = await withTimeout(work, LAYER_BUDGET_MS);
  if (result && result.__timedOut) {
    return { score: 0, reasons: [], available: false, timedOut: true };
  }
  return result;
}
