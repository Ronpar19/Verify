// messageAnalysis.js
//
// Reads a pasted or shared MESSAGE (not just its links) ON THE DEVICE and
// reduces it to a few identifiers:
//   claimedEntities  which well-known bodies the message speaks in the
//                    name of ("bank-hapoalim"), at most 3
//   messageFlags     which scam patterns its wording contains
//                    ("accountThreat", "parcelHeld", ...)
// Only those identifiers are sent to the server with each link. The text
// itself never leaves the device -- that is the privacy promise in
// public/privacy/index.html, and analyzeMessage() is the only code that
// ever sees it.
//
// The server decides what the identifiers mean: if a message claims to be
// from a body and its link does not lead to that body's own site, the
// answer is "danger" (owner's decision). That makes a false CLAIM costly,
// so detection is deliberately strict:
//   - a body counts as "claimed" only when the message speaks in its
//     name: its name opens the message and the message asks you to act,
//     or the wording carries a scam pattern (account blocked, a fee for a
//     parcel, a tax refund, a request for a code or card details)
//   - ordinary words that are also names ("max", "yes", "post", "bit")
//     never count on their own; only distinctive phrases do
//   - `opening` names are ordinary or very short words ("מקס", "ביט",
//     "max"): they count only as the very first word, the way a sender
//     signs an SMS ("מקס: ..."), and only with a scam pattern
//   - `strict` bodies -- payment methods and global brands, which shops
//     and friends mention all the time ("pay with Bit", "it's on Amazon")
//     -- count only with a scam pattern, never just for opening the
//     message
//   - links are removed before reading, so a scam domain can't make
//     itself "the claim"
//
// Ids must match api/_data/known-domains.js (test.mjs checks this).
//
// Pure JavaScript with no regex features newer than ES2018 and no
// look-behind, so it runs the same under Hermes, browsers and Node.

// Every entity: id, display name per language, and phrases in any of the
// five languages. Hebrew/Arabic phrases also match with the attached
// prefixes those languages glue onto a word (ב/ל/מ/ו/ש..., و/ب/ل...).
// A phrase ending in "*" matches any word that starts with it (Russian
// and French case/plural endings).
export const ENTITIES = [
  // ---- banks ----
  { id: 'bank-hapoalim', names: { he: 'בנק הפועלים', en: 'Bank Hapoalim', ru: 'банк Апоалим', fr: 'la banque Hapoalim', ar: 'بنك هبوعليم' },
    phrases: ['בנק הפועלים', 'בנקהפועלים', 'הפועלים', 'poalim', 'hapoalim', 'bank hapoalim', 'bankhapoalim', 'апоалим*', 'хапоалим*', 'banque hapoalim', 'هبوعليم', 'هبועليم', 'بنك العمال'] },
  { id: 'bank-leumi', names: { he: 'בנק לאומי', en: 'Bank Leumi', ru: 'банк Леуми', fr: 'la banque Leumi', ar: 'بنك لئومي' },
    phrases: ['בנק לאומי', 'בנקלאומי', 'leumi', 'bank leumi', 'bankleumi', 'банк леуми', 'банка леуми', 'банке леуми', 'banque leumi', 'لئومي', 'لؤمي', 'بنك ليئومي'] },
  { id: 'bank-discount', names: { he: 'בנק דיסקונט', en: 'Discount Bank', ru: 'банк Дисконт', fr: 'la banque Discount', ar: 'بنك ديسكونت' },
    phrases: ['בנק דיסקונט', 'דיסקונט בנק', 'discount bank', 'discountbank', 'israel discount bank', 'банк дисконт', 'банка дисконт', 'banque discount', 'بنك ديسكونت', 'טלבנק', 'telebank'] },
  { id: 'bank-mizrahi-tefahot', names: { he: 'בנק מזרחי טפחות', en: 'Mizrahi Tefahot Bank', ru: 'банк Мизрахи-Тфахот', fr: 'la banque Mizrahi Tefahot', ar: 'بنك مزراحي طفحوت' },
    phrases: ['מזרחי טפחות', 'בנק מזרחי', 'בנק טפחות', 'mizrahi tefahot', 'mizrahi bank', 'bank mizrahi', 'мизрахи*', 'тфахот', 'mizrahi-tefahot', 'banque mizrahi', 'مزراحي'] },
  { id: 'bank-fibi', names: { he: 'הבנק הבינלאומי', en: 'First International Bank', ru: 'Первый международный банк', fr: 'la First International Bank', ar: 'البنك الدولي الأول' },
    phrases: ['הבנק הבינלאומי', 'הבינלאומי הראשון', 'בנק הבינלאומי', 'first international bank', 'fibi', 'международный банк', 'البنك الدولي الأول'] },
  { id: 'bank-yahav', names: { he: 'בנק יהב', en: 'Bank Yahav', ru: 'банк Яхав', fr: 'la banque Yahav', ar: 'بنك يهاف' },
    phrases: ['בנק יהב', 'bank yahav', 'банк яхав', 'بنك يهاف'] },
  { id: 'bank-jerusalem', names: { he: 'בנק ירושלים', en: 'Bank of Jerusalem', ru: 'банк Иерусалим', fr: 'la Banque de Jérusalem', ar: 'بنك القدس' },
    phrases: ['בנק ירושלים', 'bank of jerusalem', 'bank jerusalem', 'банк иерусалим', 'بنك القدس', 'בנק ירושליים'] },
  { id: 'bank-onezero', names: { he: 'וואן זירו', en: 'One Zero', ru: 'One Zero', fr: 'One Zero', ar: 'وان زيرو' },
    phrases: ['וואן זירו', 'one zero bank', 'onezero'] },

  // ---- credit cards & payments ----
  { id: 'isracard', names: { he: 'ישראכרט', en: 'Isracard', ru: 'Исракарт', fr: 'Isracard', ar: 'يسراكارت' },
    phrases: ['ישראכרט', 'isracard', 'исракарт', 'يسراكارت', 'إسراكارت'] },
  { id: 'cal', opening: ['כאל', 'cal'], strict: true, names: { he: 'כאל', en: 'Cal', ru: 'Кал', fr: 'Cal', ar: 'كال' },
    phrases: ['כאל', 'cal online', 'cal-online', 'visa cal', 'ויזה כאל', 'כרטיסי אשראי לישראל', 'בטלפון כאל'] },
  { id: 'max', opening: ['מקס', 'max'], strict: true, names: { he: 'מקס', en: 'Max', ru: 'Макс', fr: 'Max', ar: 'ماكس' },
    phrases: ['מקס איט', 'max it', 'כרטיס מקס', 'max card', 'לאומי קארד', 'leumi card', 'max.co.il', 'חברת מקס', 'карта макс', 'بطاقة ماكس'] },
  { id: 'amex-il', opening: ['amex'], strict: true, names: { he: 'אמריקן אקספרס', en: 'American Express', ru: 'American Express', fr: 'American Express', ar: 'أمريكان إكسبريس' },
    phrases: ['אמריקן אקספרס', 'american express', 'amex', 'أمريكان إكسبريس'] },
  { id: 'diners', opening: ['דיינרס', 'diners'], strict: true, names: { he: 'דיינרס', en: 'Diners', ru: 'Diners', fr: 'Diners', ar: 'داينرز' },
    phrases: ['דיינרס', 'diners club', 'diners israel'] },
  { id: 'bit', opening: ['ביט', 'bit'], strict: true, names: { he: 'ביט', en: 'Bit', ru: 'Bit', fr: 'Bit', ar: 'بيت' },
    phrases: ['אפליקציית ביט', 'אפליקציית bit', 'באפליקציית ביט', 'העברה בביט', 'בקשת תשלום בביט', 'bit app', 'bit payment', 'приложение bit', 'تطبيق بيت', 'bitpay'] },
  { id: 'paybox', strict: true, names: { he: 'פייבוקס', en: 'PayBox', ru: 'PayBox', fr: 'PayBox', ar: 'بايبوكس' },
    phrases: ['פייבוקס', 'paybox', 'pay box', 'بايبوكس', 'пейбокс'] },
  { id: 'paypal', strict: true, names: { he: 'פייפאל', en: 'PayPal', ru: 'PayPal', fr: 'PayPal', ar: 'باي بال' },
    phrases: ['פייפאל', 'פייפל', 'paypal', 'пэйпал', 'пейпал', 'باي بال', 'بايبال'] },

  // ---- government ----
  { id: 'tax-authority', names: { he: 'רשות המסים', en: 'the Israel Tax Authority', ru: 'налоговое управление Израиля', fr: "l'administration fiscale israélienne", ar: 'سلطة الضرائب' },
    phrases: ['רשות המסים', 'רשות המיסים', 'מס הכנסה', 'מחלקת החזרי מס', 'tax authority', 'israel tax', 'налоговое управление', 'налоговой службы', 'налоговая служба', 'administration fiscale', 'impôts israël', 'سلطة الضرائب', 'ضريبة الدخل'] },
  { id: 'bituach-leumi', names: { he: 'ביטוח לאומי', en: 'National Insurance (Bituach Leumi)', ru: 'Битуах Леуми', fr: 'la Sécurité sociale (Bitouah Leumi)', ar: 'التأمين الوطني' },
    phrases: ['ביטוח לאומי', 'המוסד לביטוח לאומי', 'national insurance institute', 'national insurance', 'bituach leumi', 'битуах леуми', 'битуах-леуми', 'институт национального страхования', 'bitouah leumi', 'assurance nationale', 'التأمين الوطني', 'مؤسسة التأمين الوطني'] },
  { id: 'transport-ministry', names: { he: 'משרד התחבורה', en: 'the Ministry of Transport', ru: 'министерство транспорта', fr: 'le ministère des Transports', ar: 'وزارة المواصلات' },
    phrases: ['משרד התחבורה', 'משרד הרישוי', 'ministry of transport', 'министерство транспорта', 'министерства транспорта', 'ministère des transports', 'وزارة المواصلات'] },
  { id: 'israel-police', names: { he: 'משטרת ישראל', en: 'the Israel Police', ru: 'полиция Израиля', fr: 'la police israélienne', ar: 'شرطة إسرائيل' },
    phrases: ['משטרת ישראל', 'israel police', 'полиция израиля', 'police israélienne', 'شرطة إسرائيل'] },
  { id: 'home-front-command', names: { he: 'פיקוד העורף', en: 'the Home Front Command', ru: 'Командование тыла', fr: 'le Commandement du front intérieur', ar: 'قيادة الجبهة الداخلية' },
    phrases: ['פיקוד העורף', 'home front command', 'командование тыла', 'commandement du front intérieur', 'الجبهة الداخلية'] },
  { id: 'israel-government', names: { he: 'משרד ממשלתי', en: 'a government office', ru: 'госучреждение', fr: 'un service gouvernemental', ar: 'جهة حكومية' },
    phrases: ['משרד הפנים', 'רשות האוכלוסין', 'משרד הבריאות', 'משרד המשפטים', 'הוצאה לפועל', 'ministry of interior', 'ministry of health'] },

  // ---- post & shipping ----
  { id: 'israel-post', names: { he: 'דואר ישראל', en: 'Israel Post', ru: 'Почта Израиля', fr: 'la Poste israélienne', ar: 'البريد الإسرائيلي' },
    phrases: ['דואר ישראל', 'israel post', 'israelpost', 'почта израиля', 'почты израиля', 'poste israélienne', "poste d'israël", 'البريد الإسرائيلي', 'بريد إسرائيل'] },
  { id: 'dhl', strict: true, names: { he: 'DHL', en: 'DHL', ru: 'DHL', fr: 'DHL', ar: 'DHL' }, phrases: ['dhl', 'די אייץ אל'] },
  { id: 'ups', opening: ['ups'], strict: true, names: { he: 'UPS', en: 'UPS', ru: 'UPS', fr: 'UPS', ar: 'UPS' }, phrases: ['ups israel', 'ups ישראל', 'משלוח ups', 'ups delivery', 'ups parcel'] },
  { id: 'fedex', strict: true, names: { he: 'FedEx', en: 'FedEx', ru: 'FedEx', fr: 'FedEx', ar: 'FedEx' }, phrases: ['fedex', 'פדקס'] },
  { id: 'cheetah', names: { he: "צ'יטה", en: 'Cheetah', ru: 'Cheetah', fr: 'Cheetah', ar: 'تشيتا' }, phrases: ['ציטה שליחויות', 'cheetah delivery', 'chita delivery'] },

  // ---- utilities, tolls, transport ----
  { id: 'iec', names: { he: 'חברת החשמל', en: 'the Israel Electric Corporation', ru: 'Электрическая компания', fr: "la Compagnie d'électricité", ar: 'شركة الكهرباء' },
    phrases: ['חברת החשמל', 'חברת חשמל', 'israel electric', 'electric corporation', 'электрическая компания', 'электрической компании', "compagnie d'électricité", 'شركة الكهرباء'] },
  { id: 'mekorot', names: { he: 'מקורות', en: 'Mekorot', ru: 'Мекорот', fr: 'Mekorot', ar: 'ميكوروت' }, phrases: ['חברת מקורות', 'mekorot', 'мекорот', 'ميكوروت'] },
  { id: 'mei-avivim', names: { he: 'מי אביבים', en: 'Mei Avivim', ru: 'Мей Авивим', fr: 'Mei Avivim', ar: 'مي أفيفيم' }, phrases: ['מי אביבים', 'mei avivim'] },
  { id: 'hagihon', names: { he: 'הגיחון', en: 'Hagihon', ru: 'Агихон', fr: 'Hagihon', ar: 'هجيحون' }, phrases: ['הגיחון', 'hagihon'] },
  { id: 'kvish6', names: { he: 'כביש 6', en: 'Road 6', ru: 'Шоссе 6', fr: 'la route 6', ar: 'شارع 6' },
    phrases: ['כביש 6', 'כביש שש', 'דרך ארץ', 'road 6', 'highway 6', 'kvish 6', 'шоссе 6', 'трасса 6', 'route 6', 'شارع 6', 'طريق 6'] },
  { id: 'pango', opening: ['פנגו'], names: { he: 'פנגו', en: 'Pango', ru: 'Pango', fr: 'Pango', ar: 'بانجو' }, phrases: ['פנגו', 'pango'] },
  { id: 'cellopark', names: { he: 'סלופארק', en: 'Cellopark', ru: 'Cellopark', fr: 'Cellopark', ar: 'سيلوبارك' }, phrases: ['סלופארק', 'cellopark'] },
  { id: 'ravkav', names: { he: 'רב-קו', en: 'Rav-Kav', ru: 'Рав-Кав', fr: 'Rav-Kav', ar: 'راف كاف' }, phrases: ['רב קו', 'רבקו', 'rav kav', 'ravkav', 'рав кав', 'راف كاف'] },
  { id: 'israel-railways', names: { he: 'רכבת ישראל', en: 'Israel Railways', ru: 'Железные дороги Израиля', fr: "les Chemins de fer d'Israël", ar: 'سكك حديد إسرائيل' }, phrases: ['רכבת ישראל', 'israel railways'] },

  // ---- health funds ----
  { id: 'clalit', names: { he: 'כללית', en: 'Clalit', ru: 'Клалит', fr: 'Clalit', ar: 'كلاليت' }, phrases: ['כללית', 'שירותי בריאות כללית', 'clalit', 'клалит', 'كلاليت'] },
  { id: 'maccabi', names: { he: 'מכבי שירותי בריאות', en: 'Maccabi Healthcare', ru: 'Маккаби', fr: 'Maccabi', ar: 'مكابي' }, phrases: ['מכבי שירותי בריאות', 'קופת חולים מכבי', 'maccabi healthcare', 'maccabi4u', 'больничная касса маккаби', 'مكابي'] },
  { id: 'meuhedet', names: { he: 'מאוחדת', en: 'Meuhedet', ru: 'Меухедет', fr: 'Meuhedet', ar: 'مئوحيدت' }, phrases: ['קופת חולים מאוחדת', 'meuhedet', 'меухедет'] },
  { id: 'leumit', names: { he: 'לאומית', en: 'Leumit', ru: 'Леумит', fr: 'Leumit', ar: 'لئوميت' }, phrases: ['קופת חולים לאומית', 'לאומית שירותי בריאות', 'leumit', 'леумит'] },

  // ---- telecom ----
  { id: 'cellcom', names: { he: 'סלקום', en: 'Cellcom', ru: 'Селком', fr: 'Cellcom', ar: 'سيلكوم' }, phrases: ['סלקום', 'cellcom', 'селком', 'سيلكوم'] },
  { id: 'partner', opening: ['פרטנר', 'partner'], names: { he: 'פרטנר', en: 'Partner', ru: 'Партнер', fr: 'Partner', ar: 'بارتنر' }, phrases: ['פרטנר תקשורת', 'partner communications', 'לקוחות פרטנר', 'partner customers'] },
  { id: 'pelephone', names: { he: 'פלאפון', en: 'Pelephone', ru: 'Пелефон', fr: 'Pelephone', ar: 'بلفون' }, phrases: ['פלאפון', 'pelephone', 'пелефон', 'بلفون'] },
  { id: 'hot', opening: ['הוט', 'hot'], names: { he: 'HOT', en: 'HOT', ru: 'HOT', fr: 'HOT', ar: 'HOT' }, phrases: ['הוט מובייל', 'hot mobile', 'לקוחות הוט', 'hot net'] },
  { id: 'bezeq', names: { he: 'בזק', en: 'Bezeq', ru: 'Безек', fr: 'Bezeq', ar: 'بيزك' }, phrases: ['בזק', 'bezeq', 'безек', 'بيزك'] },
  { id: 'yes', opening: ['yes'], names: { he: 'yes', en: 'yes', ru: 'yes', fr: 'yes', ar: 'yes' }, phrases: ['לקוחות yes', 'yes tv', 'מנוי yes'] },

  // ---- retail ----
  { id: 'shufersal', strict: true, names: { he: 'שופרסל', en: 'Shufersal', ru: 'Шуферсаль', fr: 'Shufersal', ar: 'شوفرسال' }, phrases: ['שופרסל', 'shufersal', 'шуферсаль', 'شوفرسال'] },
  { id: 'rami-levy', strict: true, names: { he: 'רמי לוי', en: 'Rami Levy', ru: 'Рами Леви', fr: 'Rami Levy', ar: 'رامي ليفي' }, phrases: ['רמי לוי', 'rami levy', 'рами леви', 'رامي ليفي'] },
  { id: 'super-pharm', strict: true, names: { he: 'סופר-פארם', en: 'Super-Pharm', ru: 'Супер-Фарм', fr: 'Super-Pharm', ar: 'سوبر فارم' }, phrases: ['סופר פארם', 'סופרפארם', 'super pharm', 'superpharm', 'супер фарм'] },

  // ---- global ----
  { id: 'amazon', strict: true, names: { he: 'אמזון', en: 'Amazon', ru: 'Amazon', fr: 'Amazon', ar: 'أمازون' }, phrases: ['אמזון', 'amazon', 'амазон', 'أمازون'] },
  { id: 'aliexpress', strict: true, names: { he: 'עליאקספרס', en: 'AliExpress', ru: 'AliExpress', fr: 'AliExpress', ar: 'علي إكسبريس' }, phrases: ['עליאקספרס', 'עלי אקספרס', 'אליאקספרס', 'aliexpress', 'алиэкспресс', 'علي إكسبريس', 'علي اكسبريس'] },
  { id: 'netflix', strict: true, names: { he: 'נטפליקס', en: 'Netflix', ru: 'Netflix', fr: 'Netflix', ar: 'نتفليكس' }, phrases: ['נטפליקס', 'netflix', 'нетфликс', 'نتفليكس'] },
  { id: 'apple', strict: true, names: { he: 'אפל', en: 'Apple', ru: 'Apple', fr: 'Apple', ar: 'آبل' }, phrases: ['apple id', 'appleid', 'icloud', 'מזהה apple', 'חשבון apple', 'חשבון אפל', 'apple account', 'compte apple', 'аккаунт apple', 'معرف أبل'] },
  { id: 'microsoft', strict: true, names: { he: 'מיקרוסופט', en: 'Microsoft', ru: 'Microsoft', fr: 'Microsoft', ar: 'مايكروسوفت' }, phrases: ['microsoft account', 'מיקרוסופט', 'microsoft 365', 'office 365', 'outlook account', 'compte microsoft', 'учетная запись microsoft', 'مايكروسوفت'] },
  { id: 'google', strict: true, names: { he: 'גוגל', en: 'Google', ru: 'Google', fr: 'Google', ar: 'جوجل' }, phrases: ['google account', 'חשבון גוגל', 'חשבון google', 'gmail account', 'compte google', 'аккаунт google', 'حساب جوجل', 'حساب google'] },
  { id: 'meta', strict: true, names: { he: 'מטא (פייסבוק / וואטסאפ / אינסטגרם)', en: 'Meta (Facebook / WhatsApp / Instagram)', ru: 'Meta (Facebook / WhatsApp / Instagram)', fr: 'Meta (Facebook / WhatsApp / Instagram)', ar: 'ميتا (فيسبوك / واتساب / إنستغرام)' },
    phrases: ['facebook account', 'חשבון הפייסבוק', 'חשבון פייסבוק', 'צוות פייסבוק', 'meta support', 'whatsapp support', 'צוות וואטסאפ', 'צוות ווטסאפ', 'instagram account', 'חשבון האינסטגרם', 'compte facebook', 'аккаунт facebook', 'فريق واتساب', 'حساب فيسبوك'] },
  { id: 'spotify', strict: true, names: { he: 'ספוטיפיי', en: 'Spotify', ru: 'Spotify', fr: 'Spotify', ar: 'سبوتيفاي' }, phrases: ['spotify premium', 'ספוטיפיי', 'מנוי spotify'] },
  { id: 'binance', strict: true, names: { he: 'בייננס', en: 'Binance', ru: 'Binance', fr: 'Binance', ar: 'بينانس' }, phrases: ['binance', 'בייננס', 'бинанс'] },
];

// Scam patterns in the wording. Each raises the link's score a little on
// the server; none decides anything alone. The ones marked `claims` also
// count as the message speaking in a body's name.
export const FLAGS = [
  { key: 'accountThreat', claims: true, phrases: [
    'ייחסם', 'יחסם', 'ייחסמו', 'נחסם', 'נחסמה', 'נחסמו', 'חסימת החשבון', 'חסימת הכרטיס', 'יושעה', 'הושעה', 'תוקפא', 'יוקפא', 'הוקפא', 'הוקפאה',
    'פעילות חריגה', 'פעילות חשודה', 'חיוב חשוד', 'עסקה חשודה', 'חיוב שלא ביצעת', 'suspicious charge', 'suspicious transaction', 'ניסיון התחברות', 'כניסה חשודה', 'נדרש אימות', 'אימות זהות', 'עדכון פרטים', 'לעדכון פרטי', 'עדכן את פרטיך', 'פרטיך אינם מעודכנים',
    'account will be', 'account has been', 'account is suspended', 'account suspended', 'account locked', 'account blocked', 'unusual activity', 'suspicious activity', 'verify your identity', 'verify your account', 'update your details', 'update your account', 'unusual sign-in', 'payment failed', 'payment was declined',
    'будет заблокирован*', 'заблокирован*', 'подозрительная активность', 'подтвердите личность', 'обновите данные',
    'sera bloqué', 'compte bloqué', 'compte suspendu', 'activité suspecte', 'vérifiez votre identité', 'mettez à jour vos',
    'سيتم إيقاف', 'سيتم حظر', 'تم تعليق', 'تم إيقاف', 'نشاط مشبوه', 'تأكيد هويتك', 'تحديث بياناتك'] },
  { key: 'paymentDetails', claims: true, phrases: [
    'פרטי אשראי', 'פרטי כרטיס', 'פרטי הכרטיס', 'מספר הכרטיס', 'מספר כרטיס', '3 הספרות', 'שלוש הספרות', 'תוקף הכרטיס', 'פרטי חשבון הבנק',
    'card details', 'card number', 'credit card details', 'cvv', 'security code on the back', 'bank details',
    'данные карты', 'номер карты', 'cvv код', 'coordonnées bancaires', 'numéro de carte', 'تفاصيل البطاقة', 'رقم البطاقة', 'بيانات البطاقة'] },
  { key: 'otpRequest', claims: true, phrases: [
    'שלח את הקוד', 'שלחו את הקוד', 'שלחי את הקוד', 'מסור את הקוד', 'מסרו את הקוד', 'הקוד שקיבלת', 'את הקוד שנשלח', 'הזן את הקוד', 'הזינו את הקוד',
    'send us the code', 'send me the code', 'share the code', 'the code you received', 'enter the code you', 'reply with the code',
    'пришлите код', 'отправьте код', 'сообщите код', 'envoyez le code', 'le code reçu', 'أرسل الرمز', 'الرمز الذي وصلك', 'أرسل الكود'] },
  { key: 'parcelHeld', claims: true, phrases: [
    'חבילה ממתינה', 'החבילה ממתינה', 'החבילה מעוכבת', 'מעוכבת', 'עוכבה', 'לא ניתן למסור', 'לא הצלחנו למסור', 'משלוח ממתין', 'מסירה חוזרת', 'לתיאום מסירה', 'דמי משלוח', 'דמי מכס', 'דמי שחרור', 'דמי אחסון', 'מכס',
    'package is on hold', 'parcel is on hold', 'could not be delivered', 'unable to deliver', 'redelivery', 'delivery fee', 'customs fee', 'shipping fee', 'held at customs',
    'посылка ожидает', 'не удалось доставить', 'таможенный сбор', 'colis en attente', 'frais de livraison', 'frais de douane', 'رسوم الجمارك', 'رسوم التوصيل', 'تعذر توصيل'] },
  { key: 'refund', claims: true, phrases: [
    'החזר מס', 'החזר כספי', 'זכאי להחזר', 'זכאית להחזר', 'זכאים להחזר', 'מגיע לך החזר', 'כספים שמגיעים לך', 'זיכוי בסך', 'החזר בסך',
    'tax refund', 'refund of', 'eligible for a refund', 'you are owed', 'возврат налога', 'возврат средств', 'remboursement', "droit à un remboursement", 'استرداد ضريبي', 'استرداد مبلغ', 'مستحق لاسترداد'] },
  { key: 'debtOrFine', claims: true, phrases: [
    'חוב פתוח', 'חוב בסך', 'יתרת חוב', 'חשבונית שלא שולמה', 'טרם שולם', 'טרם שולמה', 'קנס', 'דוח חניה', 'הסדרת החוב', 'ניתוק החשמל', 'ניתוק השירות', 'ינותק', 'יינתק', 'עיקול',
    'unpaid', 'outstanding balance', 'overdue', 'a fine of', 'toll payment', 'will be disconnected', 'задолженност*', 'неоплачен*', 'штраф*', 'impayé', 'amende', 'سيتم فصل', 'مستحقات غير مدفوعة', 'غرامة'] },
  { key: 'prize', claims: true, phrases: [
    'זכית', 'זכיתם', 'זכית בפרס', 'נבחרת לזכות', 'נבחרתם לזכות', 'הגרלה', 'פרס כספי', 'מתנה מחכה', 'קיבלת מתנה',
    'you have won', 'you won', 'you have been selected', 'claim your prize', 'claim your reward', 'вы выиграли', 'ваш приз', 'vous avez gagné', 'votre cadeau', 'لقد ربحت', 'فزت', 'جائزة'] },
  { key: 'urgency', claims: false, weak: true, phrases: [
    'תוך 24 שעות', 'תוך 48 שעות', 'תוך 12 שעות', 'בתוך 24 שעות', 'עד סוף היום', 'באופן מיידי', 'בהקדם האפשרי', 'דחוף', 'התראה אחרונה', 'הודעה אחרונה',
    'within 24 hours', 'within 48 hours', 'immediately', 'final notice', 'last warning', 'urgent', 'в течение 24 часов', 'срочно', 'sous 24 heures', 'dans les 24 heures', 'urgent', 'خلال 24 ساعة', 'عاجل', 'فورا', 'فوراً'] },
];

// Asking the reader to act ("click", "log in", "pay") -- with the body's
// name at the very start, that is the shape of a message sent in its name.
const ACTION_PHRASES = [
  'לחץ', 'לחצו', 'לחצי', 'הקש', 'הקישו', 'היכנס', 'היכנסו', 'היכנסי', 'הכנס', 'הכנסו', 'כנסו', 'לכניסה', 'עדכן', 'עדכנו', 'לעדכון', 'לאימות', 'אמת', 'אמתו',
  'לאישור', 'אשר', 'אשרו', 'לתשלום', 'שלם', 'שלמו', 'להסדרה', 'הסדירו', 'לצפייה', 'לפרטים', 'לחידוש', 'להשלמת', 'השלימו', 'בקישור', 'בלינק', 'לקישור', 'בקישור הבא', 'לקבלת',
  'click', 'tap', 'log in', 'login', 'sign in', 'verify', 'confirm', 'update', 'pay', 'visit', 'via the link', 'the link below', 'follow the link',
  'нажмите', 'перейдите', 'войдите', 'подтвердите', 'обновите', 'оплатите', 'по ссылке',
  'cliquez', 'appuyez', 'connectez', 'vérifiez', 'confirmez', 'payez', 'via le lien', 'sur le lien',
  'اضغط', 'انقر', 'ادخل', 'قم بتحديث', 'تأكيد', 'ادفع', 'عبر الرابط', 'الرابط التالي', 'على الرابط',
];

// How far into the message a body's name may sit and still read as "the
// sender" (scam SMS open with "Israel Post:", "בנק הפועלים:").
const OPENING_CHARS = 12; // " בנק הפועלים" at 0, " הודעה מבנק הפועלים" at 6
const MAX_ENTITIES = 3;
const MAX_TEXT = 5000;

const HEBREW_PREFIXES = ['', 'ו', 'ב', 'ל', 'מ', 'ה', 'ש', 'כ', 'וב', 'ול', 'ומ', 'וה', 'וש', 'שב', 'של', 'שמ', 'שה', 'מה', 'לה', 'בה', 'כש', 'וכש'];
const ARABIC_PREFIXES = ['', 'و', 'ف', 'ب', 'ل', 'ك', 'وب', 'ول', 'لل', 'بال', 'وال', 'فال'];
const HEBREW_RE = /[א-ת]/;
const ARABIC_RE = /[ء-ي]/;

// Lowercase, drop links, diacritics and invisible direction marks, turn
// every non-letter into a single space, pad with spaces: then a whole
// word is simply " word ".
export function normalizeText(text) {
  let s = String(text || '').slice(0, MAX_TEXT).toLowerCase();
  s = s.replace(/https?:\/\/\S+/g, ' ').replace(/\bwww\.\S+/g, ' ');
  s = s.replace(/[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?/g, (m) => (/[a-z]/.test(m) ? ' ' : m));
  s = s.replace(/[֑-ׇ]/g, '').replace(/[ً-ٰٟ]/g, '');
  s = s.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '');
  s = s.replace(/[׳״"'`’‘״׳]/g, '');
  s = s.replace(/ё/g, 'е');
  s = s.replace(/[^a-z0-9À-ɏЀ-ӿא-תء-ي٠-٩]+/g, ' ');
  return ' ' + s.replace(/\s+/g, ' ').trim() + ' ';
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// One compiled pattern per phrase: matches " <prefix><phrase> " (or the
// start of a word, for "stem*"), on normalized text.
function compile(phrase) {
  const stem = phrase.endsWith('*');
  const core = normalizeText(stem ? phrase.slice(0, -1) : phrase).trim();
  if (!core) return null;
  const prefixes = HEBREW_RE.test(core) ? HEBREW_PREFIXES : ARABIC_RE.test(core) ? ARABIC_PREFIXES : [''];
  const pre = prefixes.filter(Boolean).map(escapeRe).join('|');
  const body = escapeRe(core).replace(/ /g, ' ');
  return new RegExp(' ' + (pre ? '(?:' + pre + ')?' : '') + body + (stem ? '[^ ]*' : '') + ' ');
}

const COMPILED_ENTITIES = ENTITIES.map((e) => ({ id: e.id, strict: !!e.strict, res: e.phrases.map(compile).filter(Boolean) }));
const COMPILED_OPENING = ENTITIES.filter((e) => e.opening).map((e) => ({ id: e.id, res: e.opening.map(compile).filter(Boolean) }));
const STRICT_IDS = new Set(ENTITIES.filter((e) => e.strict).map((e) => e.id));
const COMPILED_FLAGS = FLAGS.map((f) => ({ key: f.key, claims: f.claims, res: f.phrases.map(compile).filter(Boolean) }));
const COMPILED_ACTIONS = ACTION_PHRASES.map(compile).filter(Boolean);

function firstMatch(text, res) {
  let best = -1;
  for (const re of res) {
    const m = re.exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

// The whole analysis. Returns only identifiers, never text.
export function analyzeMessage(rawText) {
  const text = normalizeText(rawText);
  const flags = COMPILED_FLAGS.filter((f) => firstMatch(text, f.res) !== -1);
  const messageFlags = flags.map((f) => f.key);
  const hasClaimFlag = flags.some((f) => f.claims);
  const asksToAct = firstMatch(text, COMPILED_ACTIONS) !== -1;

  // Bodies mentioned, in the order they appear. A longer, more specific
  // name is matched first and blanked out, so "ביטוח לאומי" (National
  // Insurance) is never also read as "לאומי" (Bank Leumi).
  const found = [];
  let rest = text;
  const ordered = COMPILED_ENTITIES
    .flatMap((e) => e.res.map((re) => ({ id: e.id, re, len: re.source.length })))
    .sort((a, b) => b.len - a.len);
  for (const { id, re } of ordered) {
    const m = re.exec(rest);
    if (!m) continue;
    if (!found.some((f) => f.id === id)) found.push({ id, at: m.index });
    else found.find((f) => f.id === id).at = Math.min(found.find((f) => f.id === id).at, m.index);
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length - 1) + rest.slice(m.index + m[0].length - 1);
  }
  // Short names, only as the opening word -- and, like strict bodies, only
  // together with a scam pattern (checked below).
  const opening = rest.slice(0, 24);
  for (const e of COMPILED_OPENING) {
    if (found.some((f) => f.id === e.id)) continue;
    for (const re of e.res) {
      const m = re.exec(opening);
      if (m && m.index === 0) { found.push({ id: e.id, at: 0, openingOnly: true }); break; }
    }
  }
  found.sort((a, b) => a.at - b.at);

  // Speaking in the body's name: a scam pattern anywhere, or (not for
  // strict bodies) the body's name opening the message AND a request to act.
  const claimedEntities = found
    .filter((f) => hasClaimFlag || (!f.openingOnly && !STRICT_IDS.has(f.id) && f.at <= OPENING_CHARS && asksToAct))
    .slice(0, MAX_ENTITIES)
    .map((f) => f.id);

  return { claimedEntities, messageFlags };
}

export function entityName(id, lang) {
  const e = ENTITIES.find((x) => x.id === id);
  if (!e) return null;
  return e.names[lang] || e.names.en;
}

export const MESSAGE_FLAG_KEYS = FLAGS.map((f) => f.key);
export const WEAK_MESSAGE_FLAGS = FLAGS.filter((f) => f.weak).map((f) => f.key);
