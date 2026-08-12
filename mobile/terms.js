// terms.js
//
// Consent-screen copy. Bumping TERMS_VERSION (and therefore TERMS_KEY)
// forces every user — even ones who already accepted an older version —
// to see and re-accept the screen once, the next time they open the app.
//
// The legal body text below is the author-provided Hebrew original
// (`he`) — it is NOT machine-translated, on purpose: this is a liability
// document, and a mistranslated clause (limitation of liability,
// indemnification, governing law) could change its legal meaning. The
// `en`/`ru`/`fr`/`ar` slots fall back to the Hebrew original until the
// author supplies reviewed translations — fill them in below when ready,
// no other code needs to change.

export const TERMS_VERSION = 'v1';
export const TERMS_KEY = `terms_accepted_${TERMS_VERSION}`;
export const TERMS_UPDATED_DATE = '12/08/2026';

const TERMS_BODY_HE = `לפני השימוש באפליקציה, אנא קרא/י בעיון את התנאים הבאים. שימוש באפליקציה מהווה הסכמה מלאה לכל האמור להלן.

1. מהות השירות
Verify הינה אפליקציה המספקת הערכה ראשונית וטכנית בלבד לגבי מידת הסיכון הפוטנציאלי של קישור (URL). ההערכה מבוססת על שילוב של בדיקה מול מאגרי מידע חיצוניים של גורמים שלישיים (בין היתר Google Web Risk) וניתוח היוריסטי אוטומטי של מבנה הקישור. האפליקציה אינה בודקת את תוכן האתר בפועל, ואינה מהווה מערכת אבטחת מידע מקצועית.

2. אין התחייבות לדיוק
הבדיקה עשויה להניב תוצאה שגויה בשני הכיוונים:
(א) לסמן קישור כ"בטוח" או "לא ודאי" כאשר בפועל מדובר בקישור מסוכן — למשל קישור פישינג חדש שטרם דווח למאגרי המידע, אתר לגיטימי שנפרץ, או קישור המיועד באופן ממוקד וספציפי כלפי המשתמש.
(ב) לסמן קישור כ"מסוכן" או "לא ודאי" כאשר בפועל מדובר בקישור תקין.
מפתח האפליקציה אינו מתחייב, במפורש או במשתמע, לדיוק, שלמות, עדכניות או אמינות התוצאה המוצגת, בכל דרך שהיא.

3. האפליקציה היא כלי עזר בלבד
האפליקציה נועדה לשמש ככלי עזר משלים לשיקול הדעת של המשתמש, ואינה תחליף לזהירות בסיסית, בדיקה עצמאית, או להימנעות מלחיצה על קישורים ממקורות לא מוכרים. ההחלטה הסופית האם ללחוץ על קישור, להזין פרטים באתר, או לבצע כל פעולה אחרת, נתונה באחריותו הבלעדית והמלאה של המשתמש בלבד.

4. הגבלת אחריות
האפליקציה מסופקת "כפי שהיא" (AS IS) ו"כפי שזמינה" (AS AVAILABLE), ללא כל אחריות מכל סוג שהוא, מפורשת או משתמעת. מפתח האפליקציה, לרבות כל מי מטעמו, לא יישא באחריות לכל נזק — ישיר, עקיף, מיוחד, תוצאתי, או אחר — לרבות אך לא רק: אובדן כספי, גניבת זהות, גניבת מידע, נזק לציוד, או כל נזק אחר, שייגרם כתוצאה משימוש או הסתמכות על האפליקציה, לרבות כתוצאה מטעות בהערכת קישור כלשהו, בין אם הנזק נגרם עקב תקלה באפליקציה, בשירותי צד שלישי שעליהם היא מסתמכת, ובין אם מכל סיבה אחרת.

5. שיפוי
המשתמש מסכים לשפות ולפצות את מפתח האפליקציה בגין כל תביעה, דרישה, נזק או הוצאה (לרבות שכר טרחת עורך דין), הנובעים משימושו באפליקציה או מהפרת תקנון זה.

6. שירותי צד שלישי
האפליקציה משתמשת בשירות Google Web Risk API לבדיקת קישורים מול מאגרי מידע חיצוניים. השימוש בשירות זה כפוף לתנאי השימוש ומדיניות הפרטיות של Google, ומפתח האפליקציה אינו אחראי לזמינות, דיוק, או תקינות השירותים של צדדים שלישיים.

7. פרטיות
האפליקציה אינה שומרת את תוכן הקישורים שנבדקים על ידי המשתמשים לצורך זיהוי אישי, ואינה אוספת מידע מזהה מעבר לנדרש לצורך תפעול טכני בסיסי של השירות ומדדים סטטיסטיים אנונימיים (כגון כמות בדיקות כוללת).

8. שינויים בתקנון
מפתח האפליקציה רשאי לעדכן תקנון זה מעת לעת. המשך השימוש באפליקציה לאחר עדכון כאמור מהווה הסכמה לתנאים המעודכנים.

9. דין וסמכות שיפוט
על תקנון זה יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית בכל מחלוקת הנוגעת לתקנון זה או לשימוש באפליקציה תהא נתונה לבתי המשפט המוסמכים במדינת ישראל.

10. אישור
בלחיצה על "קראתי ואני מסכים/ה" ובהמשך השימוש באפליקציה, אני מאשר/ת כי קראתי, הבנתי ואני מסכים/ה לכל האמור לעיל.`;

// TODO(author): replace these with reviewed translations, then this
// fallback disappears automatically (see getTermsBody below).
const TERMS_BODY = {
  he: TERMS_BODY_HE,
  en: null,
  ru: null,
  fr: null,
  ar: null,
};

// Returns the terms body for `lang`, falling back to the Hebrew original
// (and reporting that fallback happened) when no reviewed translation
// exists yet for that language.
export function getTermsBody(lang) {
  const translated = TERMS_BODY[lang];
  return {
    text: translated || TERMS_BODY_HE,
    isFallback: !translated,
  };
}
