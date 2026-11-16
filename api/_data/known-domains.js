// api/_data/known-domains.js
//
// DATA, not logic: who the well-known bodies are, which domains are really
// theirs, and which words scammers borrow from them. api/check-link.js
// reads this; nothing here makes a decision.
//
// (A .js module rather than .json on purpose: Vercel bundles plain imports
// with no extra configuration, and comments are allowed.)
//
// HOW TO MAINTAIN
// - A body phishers imitate goes in BRANDS:
//     id       stable key (also what the app will send as `claimedEntity`)
//     domains  ONLY domains you have verified belong to it. Every subdomain
//              of a listed domain is trusted too, so never list a domain
//              where the public can publish pages (no blogspot.com,
//              sites.google.com is already an accepted, documented gap).
//     strong   made-up, distinctive names ("isracard", "hapoalim"). Seeing
//              one inside another domain's name is suspicious by itself.
//     official what to show the user as "the official domain", when it is
//              not simply domains[0] (bodies that live under gov.il)
//     noTypo   official names that are ordinary words ("partner", "office"):
//              never matched as near-misses, or "partners.com" gets flagged
//     multiTld the body really does own its name on many endings
//              (google.de, amazon.nl): the bare name on an unlisted ending
//              is not flagged
//     claimDomains  extra sites a message from this body may legitimately
//              link to without being "its own" for look-alike purposes
//              (government bodies -> gov.il). Together with `domains` and
//              `official`, this is where a message claiming to come from
//              the body may lead without being called a forgery -- so a
//              missing real domain here means a false "danger": verify
//              each body's domains before adding it.
//     words    ordinary words, surnames or very short names ("max", "cal",
//              "discount", "apple", "mizrahi"). These only count next to a
//              scam word such as "login" or "refund" -- otherwise
//              discount-sofa.co.il and mizrahi-catering.co.il get flagged.
// - A legitimate site nobody imitates goes in OTHER_KNOWN_DOMAINS.
// - After any edit: npm test && npm run eval. The evaluation must not get
//   worse; add the site that prompted the edit to eval/data.

export const BRANDS = [
  // ---- Israeli banks ----
  { id: 'bank-leumi', domains: ['leumi.co.il', 'bankleumi.co.il'], strong: ['leumi', 'bankleumi'], words: [] },
  { id: 'bank-hapoalim', claimDomains: ['bitpay.co.il'], domains: ['bankhapoalim.co.il', 'hapoalim.co.il', 'bankhapoalim.com'], strong: ['hapoalim', 'bankhapoalim', 'poalim'], words: [] },
  { id: 'bank-discount', noTypo: ['mercantile'], domains: ['discountbank.co.il', 'telebank.co.il', 'mercantile.co.il'], strong: ['discountbank', 'telebank'], words: ['discount', 'mercantile'] },
  { id: 'bank-mizrahi-tefahot', domains: ['mizrahi-tefahot.co.il'], strong: ['mizrahitefahot', 'tefahot'], words: ['mizrahi', 'mizrachi'] },
  { id: 'bank-fibi', noTypo: ['massad'], domains: ['fibi.co.il', 'bankotsar.co.il', 'bankmassad.co.il', 'massad.co.il', 'ubank.co.il'], strong: ['habeinleumi'], words: ['fibi', 'beinleumi'] },
  { id: 'bank-yahav', domains: ['bank-yahav.co.il'], strong: ['bankyahav'], words: ['yahav'] },
  { id: 'bank-jerusalem', domains: ['bankjerusalem.co.il'], strong: ['bankjerusalem'], words: [] },
  { id: 'bank-onezero', domains: ['onezerobank.com', 'onezero.co.il'], strong: ['onezerobank'], words: ['onezero'] },
  { id: 'bank-pepper', noTypo: ['pepper'], domains: ['pepper.co.il'], strong: [], words: ['pepper'] },
  { id: 'bank-of-israel', domains: ['boi.org.il'], strong: ['bankisrael'], words: [] },

  // ---- Credit cards & payments ----
  { id: 'isracard', domains: ['isracard.co.il'], strong: ['isracard'], words: [] },
  { id: 'cal', domains: ['cal-online.co.il'], strong: ['calonline'], words: ['cal', 'visacal'] },
  { id: 'max', domains: ['max.co.il'], strong: ['leumicard'], words: ['max'] },
  { id: 'amex-il', domains: ['americanexpress.co.il', 'americanexpress.com'], strong: ['americanexpress'], words: ['amex'] },
  { id: 'diners', noTypo: ['diners'], domains: ['diners.co.il'], strong: [], words: ['diners'] },
  { id: 'bit', claimDomains: ['bankhapoalim.co.il'], domains: ['bitpay.co.il'], strong: [], words: ['bit', 'bitpay'] },
  { id: 'paybox', domains: ['payboxapp.com', 'payboxapp.page.link'], strong: ['paybox', 'payboxapp'], words: [] },
  { id: 'paypal', domains: ['paypal.com', 'paypal.me'], strong: ['paypal'], words: [] },
  { id: 'visa', noTypo: ['visa'], domains: ['visa.com', 'visa.co.il'], strong: [], words: ['visa'] },
  { id: 'mastercard', domains: ['mastercard.com', 'mastercard.co.il'], strong: ['mastercard'], words: [] },

  // ---- Government & public bodies ----
  { id: 'israel-government', claimDomains: ['gov.il'], domains: ['gov.il'], strong: ['govil'], words: ['gov', 'memshala'] },
  { id: 'tax-authority', claimDomains: ['gov.il'], official: 'gov.il', domains: [], strong: ['misim', 'hamisim', 'rashuthamisim'], words: ['taxes', 'shaam'] },
  { id: 'bituach-leumi', claimDomains: ['gov.il'], official: 'btl.gov.il', domains: [], strong: ['bituachleumi'], words: ['btl', 'bituach'] },
  { id: 'transport-ministry', claimDomains: ['gov.il'], official: 'gov.il', domains: [], strong: ['hatahbura', 'misradhatahbura'], words: ['rishuy'] },
  { id: 'israel-police', claimDomains: ['gov.il'], official: 'police.gov.il', domains: [], strong: ['mishtara'], words: ['police'] },
  { id: 'home-front-command', claimDomains: ['gov.il'], noTypo: ['oref'], domains: ['oref.org.il'], strong: ['pikudhaoref'], words: ['oref'] },
  { id: 'idf', claimDomains: ['gov.il'], domains: ['idf.il'], strong: [], words: ['idf', 'tzahal'] },

  // ---- Post & shipping ----
  { id: 'israel-post', noTypo: ['mypost'], domains: ['israelpost.co.il'], strong: ['israelpost', 'doarisrael', 'mypost'], words: ['doar', 'post'] },
  { id: 'dhl', domains: ['dhl.com', 'dhl.co.il', 'dhl.de', 'express.dhl'], strong: [], words: ['dhl'] },
  { id: 'ups', domains: ['ups.com'], strong: [], words: ['ups'] },
  { id: 'fedex', domains: ['fedex.com'], strong: ['fedex'], words: [] },
  { id: 'usps', domains: ['usps.com'], strong: [], words: ['usps'] },
  { id: 'cheetah', domains: ['chitadelivery.co.il', 'cheetah-shops.co.il'], strong: ['chitadelivery'], words: ['chita', 'cheetah'] },
  { id: 'hfd', noTypo: ['epost', 'e-post'], domains: ['hfd.co.il', 'e-post.co.il', 'epost.co.il'], strong: [], words: ['hfd'] },

  // ---- Utilities, tolls, transport ----
  { id: 'iec', domains: ['iec.co.il'], strong: ['hevrathashmal', 'chevrathashmal', 'hevrathahashmal'], words: ['iec', 'hashmal', 'chashmal'] },
  { id: 'mekorot', domains: ['mekorot.co.il'], strong: ['mekorot'], words: [] },
  { id: 'mei-avivim', domains: ['mei-avivim.co.il'], strong: ['meiavivim'], words: [] },
  { id: 'hagihon', domains: ['hagihon.co.il'], strong: ['hagihon'], words: [] },
  { id: 'kvish6', domains: ['kvish6.co.il'], strong: ['kvish6'], words: ['kvish', 'road6'] },
  { id: 'pango', domains: ['pango.co.il'], strong: [], words: ['pango'] },
  { id: 'cellopark', domains: ['cellopark.co.il'], strong: ['cellopark'], words: [] },
  { id: 'ravkav', domains: ['ravkavonline.co.il'], strong: ['ravkav', 'ravkavonline'], words: [] },
  { id: 'israel-railways', noTypo: ['rail'], domains: ['rail.co.il'], strong: ['israelrail'], words: [] },
  { id: 'elal', domains: ['elal.com', 'elal.co.il'], strong: [], words: ['elal'] },

  // ---- Health funds ----
  { id: 'clalit', domains: ['clalit.co.il'], strong: ['clalit'], words: [] },
  { id: 'maccabi', domains: ['maccabi4u.co.il'], strong: ['maccabi4u'], words: ['maccabi'] },
  { id: 'meuhedet', domains: ['meuhedet.co.il'], strong: ['meuhedet'], words: [] },
  { id: 'leumit', domains: ['leumit.co.il'], strong: ['leumit'], words: [] },

  // ---- Telecom ----
  { id: 'cellcom', domains: ['cellcom.co.il'], strong: ['cellcom'], words: [] },
  { id: 'partner', noTypo: ['partner'], domains: ['partner.co.il'], strong: [], words: ['partner'] },
  { id: 'pelephone', domains: ['pelephone.co.il'], strong: ['pelephone'], words: [] },
  { id: 'hot', domains: ['hot.net.il', 'hotmobile.co.il'], strong: ['hotmobile'], words: ['hot'] },
  { id: 'bezeq', domains: ['bezeq.co.il'], strong: ['bezeq'], words: [] },
  { id: 'yes', domains: ['yes.co.il'], strong: [], words: ['yes'] },
  { id: 'golan-telecom', domains: ['golantelecom.co.il'], strong: ['golantelecom'], words: [] },

  // ---- Retail ----
  { id: 'shufersal', domains: ['shufersal.co.il'], strong: ['shufersal'], words: [] },
  { id: 'rami-levy', domains: ['rami-levy.co.il'], strong: ['ramilevy'], words: [] },
  { id: 'super-pharm', domains: ['super-pharm.co.il'], strong: ['superpharm'], words: [] },

  // ---- Global ----
  { id: 'google', multiTld: true, noTypo: ['youtu', 'android'], domains: ['google.com', 'google.co.il', 'youtube.com', 'youtu.be', 'gmail.com', 'goo.gl', 'g.co', 'forms.gle', 'android.com'], strong: ['google', 'youtube', 'gmail'], words: [] },
  { id: 'meta', noTypo: ['meta', 'threads', 'messenger'], domains: ['facebook.com', 'fb.com', 'fb.me', 'messenger.com', 'instagram.com', 'whatsapp.com', 'wa.me', 'meta.com', 'threads.net'], strong: ['facebook', 'instagram', 'whatsapp'], words: ['messenger'] },
  { id: 'apple', multiTld: true, domains: ['apple.com', 'icloud.com', 'apple.co'], strong: ['appleid', 'icloud'], words: ['apple', 'itunes'] },
  { id: 'microsoft', multiTld: true, noTypo: ['windows', 'office', 'live', 'bing', 'outlook', 'skype', 'xbox'], domains: ['microsoft.com', 'microsoftonline.com', 'live.com', 'office.com', 'outlook.com', 'microsoft365.com', 'windows.com', 'bing.com', 'msn.com', 'skype.com', 'xbox.com', 'linkedin.com', 'lnkd.in', 'aka.ms'], strong: ['microsoft', 'office365', 'linkedin'], words: ['outlook'] },
  { id: 'amazon', multiTld: true, noTypo: ['primevideo'], domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.ae', 'amazon.in', 'amazon.co.jp', 'amzn.to', 'amzn.com', 'a.co', 'primevideo.com'], strong: [], words: ['amazon'] },
  { id: 'aliexpress', noTypo: ['alibaba'], domains: ['aliexpress.com', 'aliexpress.us', 'alibaba.com'], strong: ['aliexpress'], words: ['alibaba'] },
  { id: 'ebay', multiTld: true, domains: ['ebay.com', 'ebay.co.uk', 'ebay.de'], strong: [], words: ['ebay'] },
  { id: 'temu', domains: ['temu.com'], strong: [], words: ['temu'] },
  { id: 'netflix', domains: ['netflix.com'], strong: ['netflix'], words: [] },
  { id: 'spotify', domains: ['spotify.com'], strong: ['spotify'], words: [] },
  { id: 'telegram', noTypo: ['telegram'], domains: ['telegram.org', 't.me', 'telegram.me'], strong: [], words: ['telegram'] },
  { id: 'tiktok', domains: ['tiktok.com'], strong: ['tiktok'], words: [] },
  { id: 'twitter', noTypo: ['twitter'], domains: ['twitter.com', 'x.com', 't.co'], strong: [], words: ['twitter'] },
  { id: 'booking', noTypo: ['booking'], domains: ['booking.com'], strong: [], words: ['booking'] },
  { id: 'airbnb', domains: ['airbnb.com', 'airbnb.co.il'], strong: ['airbnb'], words: [] },
  { id: 'binance', domains: ['binance.com'], strong: ['binance'], words: [] },
  { id: 'coinbase', domains: ['coinbase.com'], strong: ['coinbase'], words: [] },
];

// Whole suffixes that only the named kind of body can register under.
// gov.il: government. muni.il: municipalities. ac.il: accredited academic
// institutions. k12.il: schools. idf.il: the IDF.
export const TRUSTED_SUFFIXES = ['gov.il', 'muni.il', 'ac.il', 'k12.il', 'idf.il'];

// Legitimate, established sites that are not phishing targets in their own
// right (or whose names are ordinary words). Trusted like the brand
// domains above, but never used for look-alike matching.
export const OTHER_KNOWN_DOMAINS = [
  // Israeli finance, insurance, pension
  'esh.com', 'tranzila.com', 'cardcom.solutions', 'cardcom.co.il', 'shva.co.il', 'masav.co.il',
  'barclays.com', 'hsbc.co.il', 'sbi.co.in', 'bank.sbi',
  'harel-group.co.il', 'fnx.co.il', 'migdal.co.il', 'menoramivt.co.il', 'ayalon-ins.co.il',
  'shlomo-bit.co.il', 'aig.co.il', 'we-sure.co.il', 'shomera.co.il', 'bth.co.il', 'clalbit.co.il',
  '555.co.il', '9000000.co.il', 'hachshara.co.il', 'psagot.co.il', 'meitav.co.il', 'as-invest.co.il',
  // Israeli telecom
  '019mobile.co.il', 'wecom.co.il',
  // Israeli shipping & logistics
  'cargo.co.il', 'tapuzdelivery.co.il', 'tapuzdelivery.com', 'bar-ltd.co.il', 'boxit.co.il',
  'orian.com', 'flyingcargo.com', 'gaashwd.com', 'gcx.co.il', 'ushops.co.il', 'getpackage.com',
  'getexpress.co.il', 'dealdelivery.co.il', 'delivery.yango.com', 'wolt.com', 'd2d.co.il',
  'fritz.co.il', 'pickpack.co.il', 'zig-zag.co.il', 'downtown.co.il', 'ydm.co.il', 'nonstopb.co.il',
  'amagon.co.il', 'gett.com',
  // Israeli transport, aviation, energy
  'pti.org.il', 'ayalonhw.co.il', 'egged.co.il', 'dan.co.il', 'metropoline.com', 'kavim-t.com',
  'nateevexpress.com', 'israir.co.il', 'arkia.co.il', 'pazgas.co.il', 'supergas.co.il',
  'amisragas.co.il', 'moovitapp.com', 'waze.com',
  // Israeli retail
  'victory.co.il', 'osherad.co.il', 'zap.co.il', 'wisebuy.co.il', 'yochananof.co.il', 'tivtaam.co.il',
  'ksp.co.il', 'ivory.co.il', 'bug.co.il', 'terminalx.com', 'ikea.co.il', 'homecenter.co.il',
  'ace.co.il', 'lastprice.co.il', 'payngo.co.il', 'traklin.co.il', 'yad2.co.il', '10bis.co.il',
  'fox.co.il', 'castro.com', 'azrieli.com',
  // Israeli media & reference
  'ynet.co.il', 'walla.co.il', 'mako.co.il', 'n12.co.il', 'haaretz.co.il', 'haaretz.com',
  'themarker.com', 'calcalist.co.il', 'globes.co.il', 'kan.org.il', 'israelhayom.co.il',
  'maariv.co.il', 'jpost.com', 'timesofisrael.com', 'sport5.co.il', 'one.co.il', 'kolzchut.org.il',
  // Israeli health
  'sheba.co.il', 'hadassah.org.il', 'assuta.co.il',
  // Global
  'wikipedia.org', 'maps.app.goo.gl', 'zoom.us', 'github.com', 'dropbox.com', 'wise.com',
  'revolut.com', 'uber.com', 'discord.com', 'reddit.com', 'steampowered.com', 'chatgpt.com',
  'openai.com', 'bitpay.com', 'hotmail.com',
];

// Hosts on well-known domains where ANYONE can publish a page or a form
// (a Google Form, a shared document). A message claiming to come from a
// bank that leads here is treated like a link to an unknown site: no body
// collects your details through a public form.
export const USER_CONTENT_HOSTS = [
  'docs.google.com', 'forms.gle', 'drive.google.com', 'sites.google.com', 'script.google.com',
  'forms.office.com', 'onedrive.live.com', '1drv.ms', 'sharepoint.com', 'dropbox.com', 'github.com',
];

// Link shorteners: what they hide is the point, so a link that ENDS on one
// (nothing behind it could be followed) is worth a caution.
export const SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly',
  'shorte.st', 'tiny.cc', 'rb.gy', 'shorturl.at', 't.ly', 'did.li', 'goo.su', 'v.gd', 'bitly.com',
  'tiny.one', 'urlz.fr', 's.id', 'qr.ae', 'lnk.bio',
];

// Endings that are free or nearly free and dominated by throw-away sites.
// Deliberately NOT here: .online, .site, .shop, .store, .info, .co -- cheap,
// but also common for real small businesses.
export const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.work', '.loan', '.win', '.rest',
  '.icu', '.cyou', '.cfd', '.sbs', '.buzz', '.monster', '.quest', '.bond', '.zip', '.mov', '.cam',
  '.lol', '.support',
];

// Words scammers put next to a borrowed name ("leumi-LOGIN", "isracard-
// VERIFY"). Only ever read from the domain name itself, never from the
// path -- every real site has a /login.
export const CONTEXT_WORDS = [
  'secure', 'security', 'login', 'signin', 'logon', 'verify', 'verification', 'confirm', 'update',
  'account', 'accounts', 'password', 'auth', 'support', 'service', 'services', 'online', 'bank',
  'banking', 'card', 'cards', 'pay', 'payment', 'payments', 'bill', 'billing', 'invoice', 'refund',
  'refunds', 'delivery', 'redelivery', 'deliver', 'track', 'tracking', 'parcel', 'package', 'customs',
  'fee', 'fine', 'debt', 'toll', 'il', 'israel', 'id', 'my', 'app', 'web', 'portal', 'client',
  'customer', 'help', 'alert', 'notice', 'suspended', 'unlock', 'renew', 'renewal', 'prime', 'order',
  'orders', 'wallet', 'transfer', 'receive', 'code', 'badge', 'mobile', 'digital', 'gift', 'prize',
  'bonus', 'problem', 'session', 'area', 'form', 'zakaut', 'license', 'check', 'center',
];

// Words that describe the STORY of a scam message rather than a company:
// a parcel, a refund, a fee. A domain assembled from these plus "il" /
// "israel" ("il-customs-fee.com") has no business name in it at all.
export const SCENARIO_WORDS = [
  'refund', 'refunds', 'redelivery', 'parcel', 'package', 'customs', 'toll', 'fine', 'delivery',
  'shipment', 'tax', 'taxes', 'bill', 'payment', 'pay', 'fee', 'debt', 'invoice', 'post', 'gov',
  'benefits',
];
export const GEO_WORDS = ['il', 'israel', 'isr', 'israeli'];
