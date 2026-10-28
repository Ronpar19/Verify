// direction.js
//
// One source of truth for right-to-left layout. Each screen mirrors its own
// rows for Hebrew/Arabic (flexDirection: row-reverse), so the platform must
// NOT also mirror them, or RTL flips twice and lands back on LTR:
//
// - Native: app.json sets expo-localization's supportsRTL to false, so
//   React Native never auto-mirrors layouts on an RTL-locale device.
// - Web: the document's dir attribute follows the chosen language (right
//   for screen readers and for punctuation in Hebrew/Arabic text), and the
//   browser already mirrors flex rows under dir="rtl" — so on web we keep
//   plain 'row' and let the document do it.

import { Platform } from 'react-native';
import { isRTL } from './translations';

export function rowDirection(rtl) {
  if (Platform.OS === 'web') return 'row';
  return rtl ? 'row-reverse' : 'row';
}

export function applyDocumentDirection(lang) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
}
