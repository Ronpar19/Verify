# סיכום פרויקט: אפליקציית Verify (בדיקת קישורים)

מסמך זה מיועד להידבק/להיטען בתחילת שיחה חדשה עם Claude Code כדי לחדש
עבודה על הפרויקט בלי לאבד הקשר. הוא מרכז את **כל** מה שנעשה עד כה,
המצב המדויק של מה פרוס בפועל מול מה שקיים רק מקומית, וצ'קליסט קונקרטי
להמשך.

**Git**: הפרויקט עבר `git init` ויש לו עכשיו ריפו מרוחק ב-GitHub:
**https://github.com/Ronpar19/Verify** (ענף `main`). זהות ה-commit
מוגדרת גלובלית במחשב: `user.name=ronpar19`, `user.email=ronpar19@gmail.com`.
**חשוב**: `.claude/settings.local.json`, `mobile/public/*.apk`,
`frontend/`, ו-`verify.demo/` נמצאים ב-`.gitignore` בכוונה (הראשון כי
הוא עלול להכיל טוקנים בשורות ה-allow-list; השאר כי הם עותקים
ישנים/קובץ בינארי כבד) — **אל תסיר אותם מה-gitignore בלי לבדוק שוב
לפי אותה השיטה שמתוארת שם** (חיפוש `api[_-]?key|secret|token|password`
בכל הפרויקט + `git check-ignore -v` על כל קובץ חשוד, לפני כל commit).

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

- **בקאנד** (`https://verifyapp-khaki.vercel.app`) — פרוס ותקין, **לא
  נגעתי בו בשיחה הזו**. ה-CORS כבר תוקן (מהשיחה הקודמת).
- **PWA** (`https://verifyweb-phi.vercel.app`) — ✅ **פרוס מחדש
  ונבדק** (2026-07-30) — מציג את העיצוב החדש (כותרת "Verify",
  manifest.json מעודכן, אומת עם `curl`).
- **Android APK** — ✅ **הושלם** (2026-07-30). שני builds רצו: הראשון
  (`da88026a`) בלי `expo-updates`, לא בשימוש. **השני (`055b9686`) הוא
  הנכון** — כולל `expo-updates`, הורד והוחלף בפועל ב-
  `mobile\public\link-checker.apk` (66MB, אומת עם `curl` שהקובץ החי
  ב-`verifyweb-phi.vercel.app/link-checker.apk` תואם בגודלו בדיוק).
  ה-PWA נפרס מחדש אחרי ההחלפה (ראה למטה). לוגי ה-build הנכון:
  https://expo.dev/accounts/ronpar19/projects/mobile/builds/055b9686-ae5b-42e1-97f2-a940e23393dc
  **טרם נבדק בפועל על מכשיר**: שה-APK אכן מתקין ופועל, ושעדכון עתידי
  דרך `eas update` באמת מגיע אליו — כדאי לבדוק בפעם הראשונה שיש שינוי
  JS-בלבד לשלוח.
- **שם התצוגה של האפליקציה** — ✅ כבר "Verify" בכל מקום (נבדק
  ב-`app.json`, אין override נפרד ל-android) — תקף גם בשני ה-builds
  של היום וגם ב-PWA.

### 🔄 EAS Update הוגדר (2026-07-30) — עדכוני JS יהיו אוטומטיים מה-build הבא
הותקן `expo-updates` (`~29.0.19`) דרך `eas update:configure --non-interactive`.
זה שינה:
- `mobile/app.json`: נוסף `runtimeVersion: {"policy":"appVersion"}` ו-
  `updates.url: "https://u.expo.dev/00d908b2-81d7-4ccd-97f0-59c2587d9cf8"`.
- `mobile/eas.json`: לכל build profile יש עכשיו `channel` (הפרופיל
  שבשימוש בפועל, `preview`, מפורסם ל-channel בשם `"preview"`).

**איך זה עובד מעכשיו** (אחרי שה-build הבא באפליקציה כבר כולל את
`expo-updates`): לכל שינוי **JS בלבד** (כמו כל מה שעשינו היום — עיצוב,
טקסטים, לוגיקה) — **אין צורך ב-build חדש בכלל**. מריצים:
```powershell
cd mobile
eas update --channel preview --message "תיאור קצר של השינוי"
```
וכל מי שכבר מותקן אצלו האפליקציה יקבל את זה אוטומטית (בפעם הבאה
שהוא פותח את האפליקציה, בהינתן חיבור לאינטרנט). **build חדש (עם הורדת
APK ידנית) עדיין נדרש רק** כשמוסיפים ספרייה native חדשה (כמו
`react-native-svg`/`expo-linear-gradient` שהוספנו קודם בשיחה הזו) או
משנים משהו ב-`app.json` שדורש קומפילציה native (אייקונים, שם
האפליקציה וכו').

### ⚠️ מלכודת אמיתית שנתקלנו בה בפריסת ה-PWA — לזכור בכל פריסה עתידית
`npx expo export -p web` **מוחק ומייצר מחדש** את כל תיקיית `mobile\dist`
— כולל את `dist\.vercel\project.json` שמקשר אותה לפרויקט הנכון
(`verify_web`)! אם מריצים `vercel --prod` מיד אחרי export בלי לבדוק,
ה-CLI **יוצר פרויקט Vercel חדש בטעות** (בשם התיקייה, כלומר "dist")
במקום לפרוס ל-`verifyweb-phi.vercel.app`. בדיוק זה קרה בשיחה הזו —
נוצר פרויקט מיותר `dist-one-dun-68.vercel.app` שהמשתמש בחר **להשאיר
בינתיים** (לא למחוק, לא בשימוש). **הנוהל הנכון לכל פריסה עתידית**:
```powershell
cd mobile
npx expo export -p web
cd dist
npx vercel link --project verify_web --yes    # קריטי! לפני vercel --prod
npx vercel --prod --yes
```

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
1. **בדיקה חד-פעמית שטרם בוצעה**: להתקין את ה-APK החדש (`055b9686`)
   בפועל על מכשיר/אמולטור אנדרואיד, ואז לשלוח עדכון JS-בלבד לבדיקה:
   ```powershell
   cd mobile
   eas update --channel preview --message "בדיקת EAS Update ראשונה"
   ```
   ולוודא שהוא מגיע למכשיר בפתיחה הבאה של האפליקציה (בהינתן אינטרנט).
   זו הפעם היחידה שצריך "לוודא שהצינור עובד" — אחרי זה זה שקוף.
2. Budget Alert בגוגל קלאוד — עדיין לא הוגדר (לא דחוף).
3. חנויות אפליקציות רשמיות (App Store / Google Play) — לא נגענו,
   נדחה לטובת PWA + APK עצמאי.
4. (לא דחוף) להחליט אם למחוק את פרויקט ה-Vercel המיותר "dist"
   (`dist-one-dun-68.vercel.app`) — המשתמש בחר להשאיר אותו בינתיים.

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
