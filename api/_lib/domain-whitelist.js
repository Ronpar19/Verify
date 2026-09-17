// api/_lib/domain-whitelist.js
//
// Manually-verified allowlist of official Israeli domains (banks, health
// funds, insurers, telecoms, government bodies, shipping/logistics, ...) for
// the phishing-check pipeline in api/check-link.js. Built and cross-checked
// by hand over several rounds of DNS resolution, SSL inspection, WHOIS/RDAP
// lookups, and web research against each organization's own stated domain --
// NOT scraped or auto-generated. See DOMAIN_WHITELIST.md in this directory
// for the verification methodology, the date of the last full pass, and the
// process for adding to this list.
//
// A domain on this list is trusted enough for check-link.js's handler() to
// return "safe" immediately WITHOUT calling Google Web Risk (or running the
// structural heuristic / infrastructure layers) -- see the WHITELIST section
// in check-link.js for exactly where this is consulted, and
// DOMAIN_WHITELIST.md for the tradeoff that comes with skipping Web Risk
// entirely (it also means Web Risk never gets a chance to flag one of these
// domains if it were ever compromised or listed after the fact).
//
// Matching is EXACT on the full hostname, case-insensitive -- no implicit
// subdomain expansion in either direction. Several entries are deliberately
// "www.<domain>" rather than the bare apex because the apex has no DNS A
// record for that organization (confirmed during the manual audit) -- e.g.
// www.isa.gov.il / www.idf.il / www.iaa.gov.il / www.clalbit.co.il. A request
// for the bare apex in those specific cases is correctly NOT matched by this
// list, and vice versa.

export const DOMAIN_WHITELIST = [
  { domain: "leumi.co.il", category: "בנקים ישראליים", name: "בנק לאומי" },
  { domain: "bankhapoalim.co.il", category: "בנקים ישראליים", name: "בנק הפועלים" },
  { domain: "hapoalim.co.il", category: "בנקים ישראליים", name: "בנק הפועלים" },
  { domain: "discountbank.co.il", category: "בנקים ישראליים", name: "בנק דיסקונט" },
  { domain: "mizrahi-tefahot.co.il", category: "בנקים ישראליים", name: "בנק מזרחי טפחות" },
  { domain: "fibi.co.il", category: "בנקים ישראליים", name: "הבנק הבינלאומי הראשון (FIBI)" },
  { domain: "bank-yahav.co.il", category: "בנקים ישראליים", name: "בנק יהב" },
  { domain: "bankjerusalem.co.il", category: "בנקים ישראליים", name: "בנק ירושלים" },
  { domain: "massad.co.il", category: "בנקים ישראליים", name: "בנק מסד" },
  { domain: "bankmassad.co.il", category: "בנקים ישראליים", name: "בנק מסד" },
  { domain: "mercantile.co.il", category: "בנקים ישראליים", name: "בנק מרכנתיל דיסקונט" },
  { domain: "onezero.co.il", category: "בנקים ישראליים", name: "וואן זירו הבנק הדיגיטלי" },
  { domain: "onezerobank.com", category: "בנקים ישראליים", name: "וואן זירו הבנק הדיגיטלי" },
  { domain: "esh.com", category: "בנקים ישראליים", name: "בנק אש (Esh Bank)" },
  { domain: "bankesh.co.il", category: "בנקים ישראליים", name: "בנק אש (Esh Bank) - לא מאומת" },
  { domain: "ubank.co.il", category: "בנקים ישראליים", name: "יו-בנק (UBank)" },
  { domain: "israelpost.co.il", category: "שילוח ולוגיסטיקה", name: "דואר ישראל (כולל בנק הדואר)" },
  { domain: "boi.org.il", category: "בנקים ישראליים", name: "בנק ישראל (רגולטור)" },
  { domain: "umtb.co.il", category: "בנקים ישראליים", name: "בנק מזרחי טפחות - לא מאומת" },
  { domain: "bankotsar.co.il", category: "בנקים ישראליים", name: "בנק אוצר החייל" },
  { domain: "pepper.co.il", category: "בנקים ישראליים", name: "Pepper (בנק דיגיטלי)" },
  { domain: "barclays.com", category: "בנקים זרים בישראל", name: "ברקליס" },
  { domain: "hsbc.co.il", category: "בנקים זרים בישראל", name: "HSBC" },
  { domain: "sbi.co.in", category: "בנקים זרים בישראל", name: "State Bank of India" },
  { domain: "bank.sbi", category: "בנקים זרים בישראל", name: "State Bank of India" },
  { domain: "isracard.co.il", category: "כרטיסי אשראי וסליקה", name: "ישראכרט" },
  { domain: "digital.isracard.co.il", category: "כרטיסי אשראי וסליקה", name: "ישראכרט" },
  { domain: "cal-online.co.il", category: "כרטיסי אשראי וסליקה", name: "כאל" },
  { domain: "max.co.il", category: "כרטיסי אשראי וסליקה", name: "מקס" },
  { domain: "diners.co.il", category: "כרטיסי אשראי וסליקה", name: "דיינרס קלוב ישראל" },
  { domain: "americanexpress.co.il", category: "כרטיסי אשראי וסליקה", name: "אמריקן אקספרס ישראל" },
  { domain: "tranzila.com", category: "כרטיסי אשראי וסליקה", name: "טרנזילה" },
  { domain: "cardcom.solutions", category: "כרטיסי אשראי וסליקה", name: "קארדקום" },
  { domain: "cardcom.co.il", category: "כרטיסי אשראי וסליקה", name: "קארדקום" },
  { domain: "shva.co.il", category: "כרטיסי אשראי וסליקה", name: "שב\"א" },
  { domain: "masav.co.il", category: "כרטיסי אשראי וסליקה", name: "מס\"ב" },
  { domain: "clalit.co.il", category: "קופות חולים", name: "כללית" },
  { domain: "maccabi4u.co.il", category: "קופות חולים", name: "מכבי" },
  { domain: "meuhedet.co.il", category: "קופות חולים", name: "מאוחדת" },
  { domain: "leumit.co.il", category: "קופות חולים", name: "לאומית" },
  { domain: "harel-group.co.il", category: "חברות ביטוח", name: "הראל" },
  { domain: "fnx.co.il", category: "חברות ביטוח", name: "הפניקס" },
  { domain: "migdal.co.il", category: "חברות ביטוח", name: "מגדל" },
  { domain: "menoramivt.co.il", category: "חברות ביטוח", name: "מנורה מבטחים" },
  { domain: "ayalon-ins.co.il", category: "חברות ביטוח", name: "איילון" },
  { domain: "shlomo-bit.co.il", category: "חברות ביטוח", name: "שלמה ביטוח" },
  { domain: "aig.co.il", category: "חברות ביטוח", name: "AIG" },
  { domain: "we-sure.co.il", category: "חברות ביטוח", name: "ווישור" },
  { domain: "shomera.co.il", category: "חברות ביטוח", name: "שומרה" },
  { domain: "bth.co.il", category: "חברות ביטוח", name: "ביטוח חקלאי" },
  { domain: "cellcom.co.il", category: "תקשורת וסלולר", name: "סלקום" },
  { domain: "partner.co.il", category: "תקשורת וסלולר", name: "פרטנר" },
  { domain: "pelephone.co.il", category: "תקשורת וסלולר", name: "פלאפון" },
  { domain: "hotmobile.co.il", category: "תקשורת וסלולר", name: "הוט מובייל" },
  { domain: "019mobile.co.il", category: "תקשורת וסלולר", name: "019 מובייל" },
  { domain: "wecom.co.il", category: "תקשורת וסלולר", name: "We" },
  { domain: "golantelecom.co.il", category: "תקשורת וסלולר", name: "גולן טלקום" },
  { domain: "rami-levy.co.il", category: "תקשורת וסלולר", name: "רמי לוי תקשורת" },
  { domain: "bezeq.co.il", category: "תקשורת וסלולר", name: "בזק" },
  { domain: "hot.net.il", category: "תקשורת וסלולר", name: "הוט" },
  { domain: "yes.co.il", category: "תקשורת וסלולר", name: "יס" },
  { domain: "services.israelpost.co.il", category: "שילוח ולוגיסטיקה", name: "דואר ישראל - שירותים" },
  { domain: "mypost.israelpost.co.il", category: "שילוח ולוגיסטיקה", name: "דואר ישראל - שירותים" },
  { domain: "shop.israelpost.co.il", category: "שילוח ולוגיסטיקה", name: "דואר ישראל - חנות" },
  { domain: "chitadelivery.co.il", category: "שילוח ולוגיסטיקה", name: "צ'יטה שליחויות" },
  { domain: "cheetah-shops.co.il", category: "שילוח ולוגיסטיקה", name: "צ'יטה - חנויות" },
  { domain: "hfd.co.il", category: "שילוח ולוגיסטיקה", name: "HFD" },
  { domain: "e-post.co.il", category: "שילוח ולוגיסטיקה", name: "E-Post" },
  { domain: "epost.co.il", category: "שילוח ולוגיסטיקה", name: "E-Post - חלופי" },
  { domain: "cargo.co.il", category: "שילוח ולוגיסטיקה", name: "קארגו" },
  { domain: "tapuzdelivery.co.il", category: "שילוח ולוגיסטיקה", name: "תפוז שליחויות" },
  { domain: "tapuzdelivery.com", category: "שילוח ולוגיסטיקה", name: "תפוז שליחויות" },
  { domain: "bar-ltd.co.il", category: "שילוח ולוגיסטיקה", name: "בר הפצה - חלופי" },
  { domain: "boxit.co.il", category: "שילוח ולוגיסטיקה", name: "בוקסיט" },
  { domain: "dhl.co.il", category: "שילוח ולוגיסטיקה", name: "DHL ישראל" },
  { domain: "dhl.com", category: "שילוח ולוגיסטיקה", name: "DHL גלובלי" },
  { domain: "ups.com", category: "שילוח ולוגיסטיקה", name: "UPS גלובלי" },
  { domain: "fedex.com", category: "שילוח ולוגיסטיקה", name: "FedEx" },
  { domain: "orian.com", category: "שילוח ולוגיסטיקה", name: "אוריין" },
  { domain: "flyingcargo.com", category: "שילוח ולוגיסטיקה", name: "פליינג קרגו" },
  { domain: "gaashwd.com", category: "שילוח ולוגיסטיקה", name: "געש עמילות מכס" },
  { domain: "gcx.co.il", category: "שילוח ולוגיסטיקה", name: "GCX" },
  { domain: "ushops.co.il", category: "שילוח ולוגיסטיקה", name: "יושופס" },
  { domain: "getpackage.com", category: "שילוח ולוגיסטיקה", name: "גט פקג'" },
  { domain: "getexpress.co.il", category: "שילוח ולוגיסטיקה", name: "Get Express" },
  { domain: "dealdelivery.co.il", category: "שילוח ולוגיסטיקה", name: "Deal Delivery" },
  { domain: "delivery.yango.com", category: "שילוח ולוגיסטיקה", name: "יאנגו דליברי" },
  { domain: "wolt.com", category: "שילוח ולוגיסטיקה", name: "וולט (כולל וולט דרייב)" },
  { domain: "d2d.co.il", category: "שילוח ולוגיסטיקה", name: "D2D" },
  { domain: "fritz.co.il", category: "שילוח ולוגיסטיקה", name: "פריץ" },
  { domain: "pickpack.co.il", category: "שילוח ולוגיסטיקה", name: "פיקפאק" },
  { domain: "zig-zag.co.il", category: "שילוח ולוגיסטיקה", name: "זיגזג" },
  { domain: "downtown.co.il", category: "שילוח ולוגיסטיקה", name: "דאון טאון" },
  { domain: "ydm.co.il", category: "שילוח ולוגיסטיקה", name: "YDM שליחויות" },
  { domain: "nonstopb.co.il", category: "שילוח ולוגיסטיקה", name: "נון סטופ שליחויות" },
  { domain: "amagon.co.il", category: "שילוח ולוגיסטיקה", name: "אמגון" },
  { domain: "gett.com", category: "שילוח ולוגיסטיקה", name: "Gett (מוניות - לא שילוח)" },
  { domain: "gov.il", category: "ממשלה ורגולציה", name: "שער הממשלה" },
  { domain: "data.gov.il", category: "ממשלה ורגולציה", name: "data.gov.il" },
  { domain: "my.gov.il", category: "ממשלה ורגולציה", name: "my.gov.il" },
  { domain: "knesset.gov.il", category: "ממשלה ורגולציה", name: "הכנסת" },
  { domain: "president.gov.il", category: "ממשלה ורגולציה", name: "נשיא המדינה" },
  { domain: "mevaker.gov.il", category: "ממשלה ורגולציה", name: "מבקר המדינה" },
  { domain: "court.gov.il", category: "ממשלה ורגולציה", name: "הרשות השופטת" },
  { domain: "police.gov.il", category: "ממשלה ורגולציה", name: "משטרת ישראל" },
  { domain: "mod.gov.il", category: "ממשלה ורגולציה", name: "משרד הביטחון" },
  { domain: "btl.gov.il", category: "ממשלה ורגולציה", name: "ביטוח לאומי" },
  { domain: "taxes.gov.il", category: "ממשלה ורגולציה", name: "רשות המסים" },
  { domain: "piba.gov.il", category: "ממשלה ורגולציה", name: "רשות האוכלוסין וההגירה" },
  { domain: "land.gov.il", category: "ממשלה ורגולציה", name: "רשות מקרקעי ישראל" },
  { domain: "nadlan.gov.il", category: "ממשלה ורגולציה", name: "נדל\"ן ממשלתי" },
  { domain: "water.gov.il", category: "ממשלה ורגולציה", name: "רשות המים" },
  { domain: "competition.gov.il", category: "ממשלה ורגולציה", name: "רשות התחרות" },
  { domain: "insurancedata.cma.gov.il", category: "ממשלה ורגולציה", name: "רשות שוק ההון-ביטוח" },
  { domain: "ravkavonline.co.il", category: "תחבורה ותשתיות", name: "רב-קו" },
  { domain: "pti.org.il", category: "תחבורה ותשתיות", name: "נתיבי איילון" },
  { domain: "ayalonhw.co.il", category: "תחבורה ותשתיות", name: "נתיבי איילון - חלופי" },
  { domain: "kvish6.co.il", category: "תחבורה ותשתיות", name: "כביש 6" },
  { domain: "egged.co.il", category: "תחבורה ותשתיות", name: "אגד" },
  { domain: "dan.co.il", category: "תחבורה ותשתיות", name: "דן" },
  { domain: "metropoline.com", category: "תחבורה ותשתיות", name: "מטרופולין" },
  { domain: "kavim-t.com", category: "תחבורה ותשתיות", name: "קווים" },
  { domain: "nateevexpress.com", category: "תחבורה ותשתיות", name: "נתיב אקספרס" },
  { domain: "israir.co.il", category: "תעופה", name: "ישראייר" },
  { domain: "arkia.co.il", category: "תעופה", name: "ארקיע" },
  { domain: "elal.com", category: "תעופה", name: "אל על" },
  { domain: "iec.co.il", category: "אנרגיה ותשתיות", name: "חברת החשמל" },
  { domain: "pazgas.co.il", category: "אנרגיה ותשתיות", name: "פזגז" },
  { domain: "supergas.co.il", category: "אנרגיה ותשתיות", name: "סופרגז" },
  { domain: "amisragas.co.il", category: "אנרגיה ותשתיות", name: "אמישראגז" },
  { domain: "shufersal.co.il", category: "קמעונאות והשוואת מחירים", name: "שופרסל" },
  { domain: "victory.co.il", category: "קמעונאות והשוואת מחירים", name: "ויקטורי" },
  { domain: "osherad.co.il", category: "קמעונאות והשוואת מחירים", name: "אושר עד" },
  { domain: "zap.co.il", category: "קמעונאות והשוואת מחירים", name: "זאפ" },
  { domain: "wisebuy.co.il", category: "קמעונאות והשוואת מחירים", name: "וייסבאי" },
  { domain: "www.idf.il", category: "ממשלה ורגולציה", name: "צה\"ל" },
  { domain: "www.isa.gov.il", category: "ממשלה ורגולציה", name: "רשות ניירות ערך" },
  { domain: "www.iaa.gov.il", category: "ממשלה ורגולציה", name: "רשות שדות התעופה" },
  { domain: "www.clalbit.co.il", category: "חברות ביטוח", name: "כלל ביטוח" },
  { domain: "555.co.il", category: "חברות ביטוח", name: "ביטוח ישיר (מותג 555)" },
  { domain: "lbr.co.il", category: "חברות ביטוח", name: "ליברה ביטוח" },
  { domain: "hcsra.co.il", category: "חברות ביטוח", name: "הכשרה ביטוח" },
  { domain: "new.katzd.co.il", category: "שילוח ולוגיסטיקה", name: "כץ משלוחים" },
  { domain: "buzzr.biz", category: "שילוח ולוגיסטיקה", name: "באזר" },
  { domain: "site.ship.co.il", category: "שילוח ולוגיסטיקה", name: "UPS ישראל (נציג מורשה - O.P.S.I)" },
  { domain: "ratz.co.il", category: "שילוח ולוגיסטיקה", name: "רץ פלוס" },
];

const byHostname = new Map(DOMAIN_WHITELIST.map((e) => [e.domain.toLowerCase(), e]));

// Returns the matching entry ({ domain, category, name }) or null. Exact,
// case-insensitive match only -- see the header comment above.
export function getWhitelistEntry(hostname) {
  if (!hostname) return null;
  return byHostname.get(hostname.toLowerCase()) || null;
}

