# סיכום פרויקט: אפליקציית Verify (בדיקת קישורים)

מסמך זה מיועד להידבק/להיטען בתחילת שיחה חדשה עם Claude Code כדי לחדש
עבודה על הפרויקט בלי לאבד הקשר. הוא מרכז את **כל** מה שנעשה עד כה,
המצב המדויק של מה פרוס בפועל מול מה שקיים רק מקומית, וצ'קליסט קונקרטי
להמשך. **הערה**: אין Git בפרויקט הזה (`git status` מחזיר "not a git
repository") — אין הסטוריית קומיטים לבדוק, כל ההקשר חי במסמך הזה.

---

## מה האפליקציה עושה
עוזרת למשתמשים לבדוק אם קישור שקיבלו ב-SMS/מייל הוא פישינג/הונאה או
אמין. מדביקים קישור (או הודעה שלמה, אפילו עם כמה קישורים בתוכה),
לוחצים "בדוק קישור", ומקבלים תוצאה: ✓ בטוח, ✗ מסוכן, או "לא ניתן לקבוע
בוודאות". תמיכה מלאה בעברית, אנגלית, רוסית, צרפתית וערבית.

## ארכיטקטורה
```
[אפליקציית Expo (React Native + web)] --POST {link, lang}--> [בקאנד ב-Vercel /api/check-link] --> [Google Web Risk API]
```
מפתח ה-API של גוגל יושב **רק** בשרת (משתנה סביבה), אף פעם לא באפליקציה
עצמה. הבקאנד לא מסתמך רק על Web Risk — יש שכבה שנייה: ניתוח היוריסטי של
מבנה הקישור (סיומות דומיין חשודות, חיקוי מותג, סימן @, IP גולמי, קיצורי
קישורים). Web Risk "מסוכן" תמיד קובע; Web Risk "בטוח" מקבל חוות דעת
שנייה מההיוריסטיקה.

---

## 📁 מבנה הפרויקט בפועל (Windows)
```
Desktop\link-checker-vercel\              <- הבקאנד + שורש
├── api\check-link.js                     <- Vercel function
├── test.mjs                               <- 23 טסטים לבקאנד
├── package.json, README.md, vercel.json
├── .env.example, .gitignore
├── .vercel\project.json                   <- פרויקט Vercel "verify_app" (הבקאנד)
├── frontend\LinkCheckerScreen.js           <- ⚠️ עותק ישן/לא בשימוש, להתעלם
├── verify.demo\                            <- ⚠️ ארכיון ישן, לא בשימוש
├── PROJECT-SUMMARY.md (הקובץ הזה)
└── mobile\                                 <- אפליקציית ה-Expo בפועל ("Verify")
    ├── App.js
    ├── LinkCheckerScreen.js                <- המסך הראשי (עבר redesign מלא בשיחה הזו)
    ├── icons.js                            <- אייקוני SVG (react-native-svg) — נוסף בשיחה הזו
    ├── translations.js                     <- כל טקסטי הממשק ב-5 שפות
    ├── extractUrls.js                      <- מזהה קישורים בטקסט מודבק
    ├── test-extract-urls.mjs               <- 15 טסטים
    ├── app.json                            <- name: "Verify" (עודכן בשיחה הזו, קודם היה "mobile")
    ├── package.json, index.js
    ├── .env                                <- EXPO_PUBLIC_API_URL
    ├── assets\                             <- אייקוני האפליקציה הנייטיבית (נוצרו מחדש בשיחה הזו!)
    ├── public\                             <- תבנית ה-web/PWA (index.html, manifest.json, אייקונים, ה-APK)
    └── dist\.vercel\project.json           <- פרויקט Vercel "verify_web" (ה-PWA)
```

---

## 🚨 המצב המדויק כרגע — מה פרוס בפועל מול מה שקיים רק מקומית

**כל העיצוב מחדש שתואר למטה קיים רק בקוד המקומי (`mobile\`). שום דבר
מזה עוד לא נפרס/נבנה מחדש.** מי שכבר מותקן אצלו (PWA באייפון או ה-APK
באנדרואיד) עדיין רואה את הגרסה **הישנה** (הרקע הצבעוני המלא, בלי
הלוגו האמיתי, בלי כפתור החיפוש, בלי תפריט הצד).

- **בקאנד** (`https://verifyapp-khaki.vercel.app`) — פרוס ותקין, **לא
  נגעתי בו בשיחה הזו**. ה-CORS כבר תוקן (מהשיחה הקודמת).
- **PWA** (`https://verifyweb-phi.vercel.app`) — פרוס אבל **מציג את
  הגרסה הישנה**. כדי לעדכן:
  ```powershell
  cd mobile
  npx expo export -p web        # יוצר/מעדכן את mobile\dist
  cd dist
  vercel --prod
  ```
- **Android APK** (`mobile\public\link-checker.apk`, גם מוגש דרך ה-PWA
  ב-`/link-checker.apk`) — **בנוי מהקוד הישן**. חייב build חדש דרך EAS
  כדי לשקף את העיצוב החדש:
  ```powershell
  cd mobile
  eas build --profile preview --platform android
  ```
  (אח"כ להוריד את ה-APK החדש מ-expo.dev ולהחליף את
  `mobile\public\link-checker.apk`, ואז לפרוס מחדש את ה-PWA כמו למעלה
  כדי שגם קישור ההורדה יגיש את הגרסה החדשה.)

**המלצה**: לפני שמריצים build/deploy — לבדוק את כל השינויים פעם אחת
ב-`npx expo start --web` (יש `.claude\launch.json` מוכן עם קונפיגורציה
בשם `verify-app-web` בדיוק בשביל זה), ורק אז לפרוס.

---

## 🎨 מה נעשה בשיחה הזו — Redesign מלא לפי Claude Design

המשתמש ייבא פרויקט מ-`claude.ai/design` (`Verify App.dc.html` +
`ios-frame.jsx` + `support.js`) עם עיצוב חדש למסך הבית, ומשם התבקש
redesign מלא לאפליקציה בשתי סבבים:

### סבב 1 — העיצוב הבסיסי החדש
- **פלטת עיצוב חדשה**: רקע אפור-בהיר קבוע (`#EEF0F6`) וכרטיסי לבן,
  במקום הרקע הצבעוני המלא הישן שהשתנה לפי תוצאה (idle/safe/danger).
  הוסר לגמרי מנגנון `Animated`/`animateToColor`.
- **כפתור "בדוק קישור"** מפורש (מגדלת + gradient כחול, דרך
  `expo-linear-gradient`) — בנוסף לכפתור ההדבקה האוטומטית הקיים.
- **כרטיס תוצאה אחיד** לשלושת המצבים (בטוח/מסוכן/לא ודאי) — אייקון
  בעיגול צבעוני, כותרת, תת-כותרת (מציגה את ה-`details` מהבקאנד אם קיים),
  וכפתורי פעולה (בדוק שוב / פתח קישור / חסום ואל תמשיך / פתח בכל זאת).
  גם רשימת "כמה קישורים" עברה עיצוב מחדש באותו סגנון.
- **כפתור הגלובוס** (בורר שפה) עוצב מחדש כעיגול לבן עם אייקון גלובוס
  אמיתי (SVG, `icons.js`), נשאר בפינה **הימנית** העליונה.
- **חלונית "איך מוסיפים למסך הבית"** ל-iOS: לחיצה על כפתור ההורדה ל-iOS
  פותחת הסבר ב-4 צעדים, וכפתור "המשך לאתר" בסוף שפותח את ה-PWA
  (`verifyweb-phi.vercel.app`).
- **כפתור ההורדה לאנדרואיד** מקושר ישירות ל-APK
  (`https://verifyweb-phi.vercel.app/link-checker.apk`).
- **תלויות חדשות** ב-`mobile/package.json`: `react-native-svg`,
  `expo-linear-gradient`.
- נוספו מפתחות תרגום חדשים (5 שפות) ב-`translations.js`:
  `appName`, `tagline`, `checkBtnIdle/Busy/Again`, `checkingHint`,
  `orDivider`, `safeTitle/Subtitle`, `dangerTitle/Subtitle`,
  `unknownTitle/Subtitle`, `checkAnotherBtn`, `openLinkBtn`, `blockBtn`,
  `openAnywayBtn`, `iosDownloadBtn`, `androidDownloadBtn`,
  `iosHelpTitle/Steps/ContinueBtn/CancelBtn` ועוד.
- שורת ה-footer המקורית **נשמרה כפי שהייתה**: "כלי עזר בלבד ואינו
  מבטיח דיוק מוחלט — היו זהירים תמיד".

### סבב 2 — תיקונים לפי משוב
1. **כפתור ההדבקה האוטומטית** צומצם מרוחב-מלא לפילה קומפקטית וממורכזת.
2. **תפריט צד (☰)** חדש — כפתור המבורגר בפינה **השמאלית** העליונה
   (מול הגלובוס בימין). לחיצה פותחת פאנל צד עם שתי שורות הורדה
   (אנדרואיד + iOS), ומחליף את שורת שני הכפתורים שהייתה קבועה בתחתית
   המסך.
3. **אייקונים אמיתיים**: נוספו `AppleIcon` ו-`AndroidIcon` (SVG,
   `icons.js`) לשורות ההורדה בתפריט הצד, ו-`MenuIcon` (☰) לכפתור עצמו.
4. **שם ולוגו האפליקציה**: התגלה ש-`mobile\assets\icon.png` וכל שאר
   קבצי האייקון של האפליקציה הנייטיבית היו עדיין ברירת המחדל של Expo
   (חץ כחול גנרי) — הלוגו האמיתי (שרשרת + וי ירוק, רקע כחול-כהה
   `#14172E`) היה קיים רק בגרסת ה-PWA (`mobile\public\icon-512.png`
   וכו'). **נוצרו מחדש כל קבצי האייקון החסרים** מתוך אותו לוגו (עם
   הסרת רקע/מטה לגרסת ה-adaptive icon השקופה של אנדרואיד + גרסה
   מונוכרומטית ל-Android 13+):
   - `assets/icon.png`, `assets/favicon.png`, `assets/splash-icon.png`
   - `assets/android-icon-background.png` (מילוי צבע אחיד תואם)
   - `assets/android-icon-foreground.png` (הלוגו עם רקע שקוף)
   - `assets/android-icon-monochrome.png` (סיליהואטה לבנה)
   - `assets/logo.png` — עותק בגודל בינוני, בשימוש **במסך הראשי עצמו**
     (במקום האימוג'י/אייקון הגנרי הקודם).
   - `app.json`: `expo.name` שונה מ-`"mobile"` ל-**`"Verify"`**, ונוסף
     בלוק `splash` (רקע כחול-כהה תואם ללוגו).
   - `mobile/public/index.html` ו-`manifest.json`: הכותרת/שם השתנו
     מ-"בדיקת קישורים" ל-**"Verify"**, וצבעי ה-theme/background עודכנו
     לתאום לעיצוב החדש (`#3F5AE0` / `#EEF0F6`).
5. **הערה חשובה מהמשתמש**: מי שכבר התקין את האפליקציה (APK או PWA) לא
   יקבל אף אחד מהשינויים האלה אוטומטית — ראה סעיף "המצב המדויק כרגע"
   למעלה.

### 🐛 באג אמיתי שהתגלה ותוקן: Modal לא נסגר
תוך כדי בדיקת תפריט הצד בדפדפן, גיליתי שלחיצה על כפתור הסגירה (×) או
על הרקע **לא סגרה** את הפאנל — למרות שה-state הפנימי (`menuVisible`)
**כן** התעדכן נכון ל-`false` (אומת עם `console.log` בתוך ה-handler
ובתוך ה-render). כלומר: React בצד האפליקציה עבד נכון, אבל ה-`<Modal>`
של `react-native-web` לא הסיר בפועל את התוכן מה-DOM.

**הסיבה**: `animationType="fade"` על ה-`<Modal>` — ב-web, המימוש הזה
כנראה תקוע במעבר האנימציה וה-DOM נשאר "תקוע" גם אחרי ש-`visible`
הפך ל-`false`. **התיקון**: הוסר `animationType="fade"` משלושת ה-Modal
באפליקציה (תפריט הצד, בורר השפה, וחלונית ההסבר ל-iOS) — הם נפתחים
ונסגרים כרגיל (בלי fade), ואומת שוב ושוב בדפדפן שהכל עובד נכון אחרי
זה. **אם בעתיד רוצים להחזיר אנימציה** — לבדוק גרסה חדשה יותר של
`react-native-web`/`react-native`, או להשתמש ב-`Animated` ידני במקום
ה-`animationType` המובנה.

---

## סטטוס — מה כבר עובד
- **Google Cloud**: פרויקט קיים, Billing מקושר, Web Risk API מופעל,
  מפתח API מוגבל ל-Web Risk API בלבד.
- **בקאנד**: 23/23 טסטים עוברים (`node test.mjs` מהשורש). CORS פתור.
  פרוס וחי ב-`https://verifyapp-khaki.vercel.app`.
- **extractUrls**: 15/15 טסטים עוברים (`node test-extract-urls.mjs`
  מתוך `mobile\`).
- **קוד ה-Expo**: כתוב ומוטמע בפועל, עבר redesign מלא (ראה למעלה),
  נבדק ב-`npx expo export -p web` (מצליח, ללא שגיאות) וגם ידנית
  בדפדפן (כולל בדיקה חיה מול הבקאנד האמיתי — תוצאת "מסוכן" עבור
  `http://testsafebrowsing.appspot.com/s/malware.html` הוצגה נכון).
- **גרסת SDK**: 54. `react`/`react-dom` 19.1.0, `react-native` 0.81.5.
  תלויות חדשות: `react-native-svg` 15.12.1, `expo-linear-gradient`
  ~15.0.8.
- **חשבון Expo**: `ronpar19` / `ronpar19@gmail.com`.
- **Git לא מותקן/לא בשימוש** בפרויקט הזה בכלל.

## מה עדיין לא נעשה / הצעד הבא
1. **להריץ build חדש ל-Android** (`eas build --profile preview
   --platform android`) כדי שהגרסה המחודשת תגיע ל-APK, ולהחליף את
   `mobile\public\link-checker.apk` בתוצאה.
2. **לפרוס מחדש את ה-PWA** (`npx expo export -p web` מתוך `mobile`,
   ואז `vercel --prod` מתוך `mobile\dist`) כדי שהעיצוב החדש יגיע
   למי שכבר מותקן אצלו וגם למי שמוריד עכשיו.
3. Budget Alert בגוגל קלאוד — עדיין לא הוגדר (לא דחוף).
4. חנויות אפליקציות רשמיות (App Store / Google Play) — לא נגענו,
   נדחה לטובת PWA + APK עצמאי.

## החלטות מפתח ולמה
- **Web Risk API, לא Safe Browsing v4** (מסחרי + לא deprecated).
- **Vercel Hobby (חינמי) מוגבל לשימוש לא-מסחרי** — לזכור אם עוברים
  למודל רווחים.
- **רגישות גבוהה לעלויות** — כל המלצה כדאי שתוביל בבדיקת "האם זה
  חינמי/יש חלופה חינמית".
- **בלי גרדיאנטים מורכבים מדי / בלי ספריות פונט חיצוניות** (כמו
  Google Fonts "Rubik" שהופיעה בעיצוב המקורי) — נשמר על הפונט
  הדיפולטי של המערכת כדי לא לסבך build נייטיבי; שאר הסגנון (צבעים,
  מרווחים, אייקוני SVG) הועתק במדויק מהעיצוב שיובא מ-Claude Design.
- **המשתמש עובד ישירות עם Claude Code** על המחשב (לא Cursor, לא
  העתק-הדבק ידני) — יש הרשאות מלאות לעריכת קבצים, הרצת פקודות,
  והרצת דפדפן-תצוגה מקדימה (`.claude\launch.json`, קונפיגורציה
  `verify-app-web`: `cd mobile && npx expo start --web`, פורט 8081).

## רעיונות להמשך (לא דחוף, לפי סדר עדיפות)
1. Rate limiting על ה-endpoint הציבורי (header עם סוד משותף).
2. שיתוף ישיר מ-Messages/Mail (Share Extension) — דורש native config
   plugin.
3. סריקת QR (הונאות "quishing") — מתחבר ישירות ל-`runCheck()` הקיים.
4. שמירת בחירת שפה בין הפעלות (AsyncStorage).
5. קאשינג לתוצאות חוזרות + סטטיסטיקות שימוש (דורש DB).
6. שדרוג `react-native`/`react-native-web` בעתיד ובדיקה אם אפשר
   להחזיר `animationType="fade"` ל-Modal-ים (ראה סעיף הבאג למעלה).
