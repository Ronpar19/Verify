// translations.js
//
// Central place for every piece of UI text shown in LinkCheckerScreen.js,
// in every supported language. To add a language later: add one entry to
// LANGUAGES below and one matching block to STRINGS — nothing else in the
// app needs to change.
//
// Default language = whatever the device's first supported locale is; if
// the device's locale isn't one we support, we fall back to Hebrew (see
// getDeviceDefaultLanguage below).

export const LANGUAGES = [
  { code: 'he', name: 'עברית', flag: '🇮🇱', rtl: true },
  { code: 'en', name: 'English', flag: '🇺🇸', rtl: false },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
];

export const DEFAULT_LANGUAGE = 'he';

const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

export function isSupported(code) {
  return SUPPORTED_CODES.includes(code);
}

export function isRTL(code) {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? lang.rtl : false;
}

export const STRINGS = {
  he: {
    eyebrow: 'בדיקת קישורים',
    languageButtonA11y: 'שנה שפה',
    languagePickerTitle: 'בחר שפה',
    statusLabel: {
      idle: '',
      loading: 'בודק...',
      safe: 'לא נמצאו איומים ידועים',
      danger: 'הקישור מסומן כמסוכן — לא מומלץ ללחוץ',
      unknown: 'לא ניתן לקבוע בוודאות — היו זהירים',
    },
    placeholder: 'הדביקו כאן את הקישור',
    clearA11y: 'נקה קישור',
    autoPasteBtn: 'הדבקה אוטומטית',
    connectionError: 'לא הצלחנו להתחבר לשרת הבדיקה. בדקו את החיבור לאינטרנט ונסו שוב.',
    footer: 'כלי עזר בלבד ואינו מבטיח דיוק מוחלט — היו זהירים תמיד',
    multiFoundCount: (n) => `נמצאו ${n} קישורים בהודעה`,
    multiLoading: (i, n) => `בודק קישור ${i} מתוך ${n}...`,
    multiSafe: 'כל הקישורים שנמצאו בטוחים',
    multiDanger: 'לפחות אחד מהקישורים מסומן כמסוכן — היו זהירים',
    multiUnknown: 'לא ניתן לקבוע בוודאות לגבי חלק מהקישורים — היו זהירים',
  },
  en: {
    eyebrow: 'Link Checker',
    languageButtonA11y: 'Change language',
    languagePickerTitle: 'Choose language',
    statusLabel: {
      idle: '',
      loading: 'Checking...',
      safe: 'No known threats found',
      danger: 'This link is flagged as dangerous — do not click',
      unknown: 'Could not determine for certain — be careful',
    },
    placeholder: 'Paste the link here',
    clearA11y: 'Clear link',
    autoPasteBtn: 'Auto-paste',
    connectionError: 'Could not connect to the checking server. Check your internet connection and try again.',
    footer: 'This is only a helper tool and accuracy is not guaranteed — always be careful',
    multiFoundCount: (n) => `${n} links found in the message`,
    multiLoading: (i, n) => `Checking link ${i} of ${n}...`,
    multiSafe: 'All links found are safe',
    multiDanger: 'At least one link is flagged as dangerous — be careful',
    multiUnknown: 'Could not determine for certain for some links — be careful',
  },
  ru: {
    eyebrow: 'Проверка ссылок',
    languageButtonA11y: 'Сменить язык',
    languagePickerTitle: 'Выберите язык',
    statusLabel: {
      idle: '',
      loading: 'Проверка...',
      safe: 'Известных угроз не обнаружено',
      danger: 'Ссылка помечена как опасная — не рекомендуется переходить',
      unknown: 'Невозможно точно определить — будьте осторожны',
    },
    placeholder: 'Вставьте ссылку сюда',
    clearA11y: 'Очистить ссылку',
    autoPasteBtn: 'Автовставка',
    connectionError: 'Не удалось подключиться к серверу проверки. Проверьте подключение к интернету и попробуйте снова.',
    footer: 'Это только вспомогательный инструмент, точность не гарантируется — всегда будьте осторожны',
    multiFoundCount: (n) => `Найдено ссылок в сообщении: ${n}`,
    multiLoading: (i, n) => `Проверка ссылки ${i} из ${n}...`,
    multiSafe: 'Все найденные ссылки безопасны',
    multiDanger: 'Как минимум одна ссылка помечена как опасная — будьте осторожны',
    multiUnknown: 'Не удалось точно определить для некоторых ссылок — будьте осторожны',
  },
  fr: {
    eyebrow: 'Vérification de liens',
    languageButtonA11y: 'Changer de langue',
    languagePickerTitle: 'Choisir la langue',
    statusLabel: {
      idle: '',
      loading: 'Vérification...',
      safe: 'Aucune menace connue détectée',
      danger: 'Ce lien est signalé comme dangereux — ne cliquez pas',
      unknown: 'Impossible de déterminer avec certitude — soyez prudent',
    },
    placeholder: 'Collez le lien ici',
    clearA11y: 'Effacer le lien',
    autoPasteBtn: 'Collage automatique',
    connectionError: "Impossible de se connecter au serveur de vérification. Vérifiez votre connexion internet et réessayez.",
    footer: "Ceci est seulement un outil d'aide et l'exactitude n'est pas garantie — soyez toujours prudent",
    multiFoundCount: (n) => `${n} liens trouvés dans le message`,
    multiLoading: (i, n) => `Vérification du lien ${i} sur ${n}...`,
    multiSafe: 'Tous les liens trouvés sont sûrs',
    multiDanger: 'Au moins un lien est signalé comme dangereux — soyez prudent',
    multiUnknown: 'Impossible de déterminer avec certitude pour certains liens — soyez prudent',
  },
  ar: {
    eyebrow: 'فحص الروابط',
    languageButtonA11y: 'تغيير اللغة',
    languagePickerTitle: 'اختر اللغة',
    statusLabel: {
      idle: '',
      loading: 'جارٍ الفحص...',
      safe: 'لم يتم العثور على تهديدات معروفة',
      danger: 'تم وضع علامة على هذا الرابط بأنه خطير — لا يُنصح بالنقر عليه',
      unknown: 'تعذّر التحديد بشكل مؤكد — كن حذرًا',
    },
    placeholder: 'الصق الرابط هنا',
    clearA11y: 'مسح الرابط',
    autoPasteBtn: 'لصق تلقائي',
    connectionError: 'تعذّر الاتصال بخادم الفحص. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
    footer: 'هذه أداة مساعدة فقط ولا تضمن الدقة الكاملة — كن حذرًا دائمًا',
    multiFoundCount: (n) => `تم العثور على ${n} روابط في الرسالة`,
    multiLoading: (i, n) => `جارٍ فحص الرابط ${i} من ${n}...`,
    multiSafe: 'جميع الروابط التي تم العثور عليها آمنة',
    multiDanger: 'تم وضع علامة على رابط واحد على الأقل بأنه خطير — كن حذرًا',
    multiUnknown: 'تعذّر التحديد بشكل مؤكد بالنسبة لبعض الروابط — كن حذرًا',
  },
};

// deviceLocales: the array returned by expo-localization's
// Localization.getLocales(), e.g. [{ languageCode: 'fr', ... }, ...].
// Picks the first one we support; if none match, defaults to Hebrew.
export function getDeviceDefaultLanguage(deviceLocales) {
  if (Array.isArray(deviceLocales)) {
    for (const locale of deviceLocales) {
      const code = (locale.languageCode || '').toLowerCase();
      if (isSupported(code)) return code;
    }
  }
  return DEFAULT_LANGUAGE;
}
