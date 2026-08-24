# סיכום פרויקט: אפליקציית Verify (בדיקת קישורים)

מסמך זה מתעד את מצב הפרויקט — הארכיטקטורה, מה פרוס בפועל, וההחלטות
המרכזיות מאחורי הקוד הקיים ולמה הן התקבלו. הוא מתעדכן ככל שהפרויקט
מתפתח, לא נכתב מחדש בכל שיחה.

**Git**: ריפו מרוחק ב-GitHub: **https://github.com/Ronpar19/Verify**
(ענף `main`). זהות ה-commit: `user.name=ronpar19`,
`user.email=ronpar19@gmail.com`.
**חשוב**: `.claude/settings.local.json`, `mobile/public/*.apk`,
`frontend/`, ו-`verify.demo/` נמצאים ב-`.gitignore` בכוונה (הראשון כי
הוא עלול להכיל טוקנים בשורות ה-allow-list; השאר כי הם עותקים
ישנים/קובץ בינארי כבד) — **אל תסיר אותם מה-gitignore בלי לבדוק שוב**
(חיפוש `api[_-]?key|secret|token|password` בכל הפרויקט + `git
check-ignore -v` על כל קובץ חשוד, לפני כל commit).

---

## מה האפליקציה עושה
עוזרת למשתמשים לבדוק אם קישור שקיבלו ב-SMS/מייל/הודעה הוא פישינג/הונאה
או אמין. מדביקים קישור (או הודעה שלמה עם כמה קישורים בתוכה — כולל
שיתוף ישיר מ-Messages/WhatsApp דרך Android share-intent), לוחצים "בדוק
קישור", ומקבלים תוצאה: 🟢 בטוח, 🔴 מסוכן, או 🟡 "לא ניתן לקבוע
בוודאות". תמיכה מלאה ב-5 שפות (עברית, אנגלית, רוסית, צרפתית, ערבית)
כולל RTL, ותמיכה בקורא מסך (accessibility roles/labels/live-regions)
לכל האורך.

## ארכיטקטורה

```
[Expo app: PWA / APK / share-intent] --POST {link, lang}--> [Vercel /api/check-link]
                                                                     │
                                                          resolve redirects (SSRF guard)
                                                                     │
                                          ┌──────────────────────────┼──────────────────────────┐
                                          ▼                          ▼                          ▼
                                   heuristic מבני            Google Web Risk            DNS / RDAP infra
                              (typosquatting, homoglyphs,   (רץ במקביל לשכבת ה-infra —   (private-IP destination,
                               encoding, complexity...)      "מסוכן" חוזר מיד, לא          domain age)
                                          │                   ממתין לתוצאת ה-infra)              │
                                          └──────────────────────────┬──────────────────────────┘
                                                                     ▼
                                                          score/reasons משולבים
                                                                     ▼
                                                        safe · uncertain · dangerous
```

מפתח ה-API של גוגל יושב **רק** בשרת (משתנה סביבה), אף פעם לא באפליקציה
עצמה. הבקאנד לא מסתמך רק על Web Risk — יש **שלושה** אותות בלתי-תלויים
שמשולבים לניקוד אחד (לא שלוש תוצאות נפרדות): Web Risk, heuristic מבני
של הקישור עצמו, ושכבת DNS/infrastructure. Web Risk "מסוכן" תמיד קובע
מיידית; Web Risk "בטוח" מקבל חוות דעת שנייה (ושלישית) לפני שהוא
מוחזר למשתמש כפי שהוא.

---

## 📁 מבנה הפרויקט בפועל (Windows)
```
Desktop\link-checker-vercel\              <- הבקאנד + שורש
├── api\
│   ├── check-link.js                     <- Vercel function הראשי
│   ├── stats.js                          <- endpoint פנימי לצפייה בסטטיסטיקות שימוש
│   └── _lib\
│       ├── redis.js                      <- לקוח Upstash Redis משותף
│       ├── stats.js                      <- ספירת שימוש פרטית (בלי לשמור תוכן קישורים)
│       └── infrastructure.js             <- שכבת DNS/RDAP (נוספה בשיחה אחרונה)
├── test.mjs                               <- 130 טסטים לבקאנד (heuristic + infra + API)
├── extractUrls.js, translations.js, test-extract-urls.mjs
│                                          <- ⚠️ עותקים ישנים/לא בשימוש מלפני הפיצול ל-mobile/,
│                                             translations.js כאן מיושן משמעותית (157 שורות מול
│                                             345 ב-mobile/translations.js) — מועמדים למחיקה,
│                                             טרם אושר
├── package.json, README.md, vercel.json
├── DEPLOYMENT.md                          <- מדריך פריסה מלא צעד-אחר-צעד
├── .env.example, .gitignore
├── .vercel\project.json                   <- פרויקט Vercel "verify_app" (הבקאנד)
├── frontend\, verify.demo\                <- ⚠️ ארכיונים ישנים, ב-gitignore, לא בשימוש
└── mobile\                                 <- אפליקציית ה-Expo בפועל ("Verify")
    ├── App.js                             <- root component, מנהל מסך תנאי שימוש מול המסך הראשי
    ├── LinkCheckerScreen.js               <- המסך הראשי
    ├── TermsScreen.js, terms.js           <- מסך הסכמה חד-פעמי + טקסט התקנון
    ├── icons.js, statusIcons.js           <- אייקוני SVG (react-native-svg)
    ├── translations.js                    <- כל טקסטי הממשק, 5 שפות (המקור האמיתי)
    ├── extractUrls.js, test-extract-urls.mjs  <- מזהה קישורים בטקסט, 15 טסטים
    ├── app.json, eas.json, index.js, package.json
    ├── .env                                <- EXPO_PUBLIC_API_URL, EXPO_PUBLIC_APP_SECRET
    ├── assets\                             <- אייקוני האפליקציה הנייטיבית
    ├── public\                             <- תבנית ה-web/PWA
    │   ├── index.html, manifest.json, אייקונים, link-checker.apk
    │   ├── download\index.html             <- דף נחיתה להורדה (Android + הסבר iOS)
    │   └── privacy\index.html              <- מדיניות פרטיות ציבורית (נדרש ל-Play Console)
    └── dist\.vercel\project.json           <- פרויקט Vercel "verify_web" (ה-PWA)
```

---

## 🚀 מה פרוס בפועל כרגע
- **בקאנד** (`https://verifyapp-khaki.vercel.app`) — פרוס ותקין, כולל
  שכבת ה-DNS/infrastructure העדכנית ביותר. נבדק ישירות בפרודקשן
  (curl) אחרי כל deploy.
- **PWA** (`https://verifyweb-phi.vercel.app`) — פרוס ותקין, כולל
  דפי `/download` ו-`/privacy`.
- **Android APK** — קיים ומעודכן ב-`mobile/public/link-checker.apk`,
  מוגש דרך ה-PWA. `expo-updates` מוגדר כך שעדכוני JS-בלבד מגיעים
  אוטומטית דרך `eas update --channel preview` בלי build חדש —
  **טרם אומת בפועל על מכשיר פיזי** שהצינור הזה עובד קצה-לקצה (זו
  עדיין הבדיקה החד-פעמית שנשארה פתוחה).
- **CORS**: מוגבל ל-origin של ה-PWA (+ preview deployments שלו) ול-
  localhost בלבד, לא פתוח לכל.
- **Rate limiting, shared-secret auth, usage stats**: פעילים דרך
  Upstash Redis (fail-open אם לא מוגדר).

### ⚠️ מלכודות אמיתיות שנתקלנו בהן — לזכור בכל פריסה עתידית
1. **`npx expo export -p web` מוחק ומייצר מחדש** את `mobile\dist`,
   כולל `dist\.vercel\project.json`. אם מריצים `vercel --prod` מיד
   אחרי export בלי לקשר מחדש, ה-CLI יוצר בטעות פרויקט Vercel חדש.
   **הנוהל הנכון**:
   ```powershell
   cd mobile
   npx expo export -p web
   cd dist
   npx vercel link --project verify_web --yes    # קריטי! לפני vercel --prod
   npx vercel --prod --yes
   ```
2. **בדיקת CORS מבוססת `NODE_ENV`** נכשלה בפועל: `mobile/.env` מצביע
   את ה-web build אל הבקאנד **הפרוס** גם בפיתוח מקומי (`expo start
   --web`), ו-Vercel קובע `NODE_ENV=production` על כל deployment, כולל
   Preview. פתרון: allowlist מבוסס origin regex (`localhost` תמיד
   מותר, `verifyweb(-*)?.vercel.app` מותר), לא תלוי ב-`NODE_ENV`.
3. **שאילתות NS (nameservers) חייבות לרוץ מול ה-registrable domain**,
   לא מול ה-hostname המלא — resolver אמיתי החזיר `ENODATA` עבור
   `www.google.com` (ולפעמים אפילו `google.com`, תלוי resolver) למרות
   שלגוגל *יש* NS records. בגלל זה "no nameservers" **לא** נשקל בציון
   בכלל (ראה למטה).
4. **RDAP לא קיים ל-`.il`** — לא flakiness, עובדה מבנית: `.il` פשוט לא
   רשום ב-bootstrap הרשמי של IANA (`data.iana.org/rdap/dns.json`).
   אומת ישירות, לא הונח. domain-age פשוט "אין מידע" עבור `.il`, וזו
   ההתנהגות הרצויה (לא penalty).
5. **דומיינים "חשודים" יכולים להיות רשומים באמת** — `paypa1.com`
   (טעות הקלדה של PayPal) מפנה בפועל ל-`paypal.com` האמיתי (רישום
   הגנתי, כנראה ע"י PayPal עצמה). אל תניחו שקישור עם שם דומיין
   "מפוקפק" יתנהג כצפוי ב-בדיקה חיה — לבדוק תמיד עם unit tests
   ב-mock, ורק לאמת קצה-לקצה עם דומיינים ידועים (google.com, או
   `http://testsafebrowsing.appspot.com/s/malware.html` — ה-URL
   הרשמי של גוגל לבדיקות Web Risk, בטוח לשימוש).

---

## 🧠 שכבות הזיהוי — מה יש, ולמה

### 1. Web Risk (הבסיס המקורי)
קריאה ל-Google Web Risk API מול רשימות איומים ידועות. אמין אבל
תגובתי בלבד — לא יודע על איום שעדיין לא דווח.

### 2. Heuristic מבני (`heuristicAnalysis()` ב-`api/check-link.js`)
נבנה במקור עם בדיקות בסיסיות (סיומת TLD חשודה, חיקוי מותג פשוט, סימן
`@`, IP גולמי, קיצור קישורים), ואז **שודרג משמעותית**:
- **Typosquatting אמיתי**: Levenshtein distance מול `KNOWN_SAFE_DOMAINS`
  (לא רשימת מותגים נפרדת), כולל נורמליזציה של leetspeak
  (`paypa1`→`paypal`, `g00gle`→`google`).
- **Registrable domain נכון** דרך `psl` (Public Suffix List) במקום
  `split('.')` נאיבי — מבדיל נכון בין `login.paypal.com` (לגיטימי)
  ל-`paypal.com.evil.com` (העמדת פנים).
- **זיהוי Homoglyph**: תווים מ-Unicode script אחר (קירילי/יווני)
  שנראים כמו אותיות לטיניות (`аpple.com` עם а קירילי), דרך `punycode`.
- **זיהוי obfuscation ב-encoding**: קידוד percent-encoding מיותר של
  תווים "unreserved" (למשל שם מותג מקודד אות-אות), double-encoding,
  ו-delimiters מקודדים (`%2F`/`%40`/`%2E`) בנתיב ה-URL בלבד (לא
  ב-query string, כדי לא לתפוס false positive על redirect URLs
  לגיטימיים).
- **complexity ו-entropy** (חתימות חלשות): אורך URL חריג, hostname
  "אקראי" (זוהה דרך יחס ספרות/תנועות, לא Shannon entropy גולמי — נבדק
  אמפירית שאנטרופיה גולמית על מחרוזות קצרות לא אמינה).
- **Combination bonuses**: כמה אותות חלשים יחד (למשל brand + TLD חשוד
  + מילות דחיפות) מקבלים בונוס, **אך לעולם לא** מפעילים
  `highConfidence` — זו הייתה החלטה מפורשת כדי לשמור false positives
  נמוכים.

### 3. DNS / Infrastructure layer (`api/_lib/infrastructure.js` — החדש ביותר)
שכבה נפרדת ומודגשת בכוונה מה-heuristic, כי היא מבוססת על **תשתית
בפועל** של הדומיין, לא על מבנה ה-URL:
- **Private/internal IP resolution**: resolve עצמאי ל-A/AAAA (דרך
  `dns.promises`), סיווג IP עם `ipaddr.js` (מטפל נכון ב-IPv4-mapped
  IPv6, TEST-NET ranges, וכו').
- **Domain age דרך RDAP ציבורי** (`rdap.org` bootstrap) — לא WHOIS
  מסחרי.
- **ASN**: **לא מומש** בכוונה — דורש מאגר IP-to-ASN (MaxMind וכו', לא
  "local" באמת) או שירות חיצוני. נשאר `placeholder` (`asnLookup()`)
  לעתיד.
- **Race pattern עם Web Risk**: שתי הבדיקות מתחילות **במקביל**. אם
  Web Risk מחזיר "מסוכן" — התשובה חוזרת מיד, בלי להמתין ל-infra (שום
  infra signal לא יכול לשנות verdict סופי-כבר). אם לא — ה-handler
  ממתין לתוצאת ה-infra ומשלב אותה לציון אחד.
- **TOCTOU / DNS rebinding — החלטה קריטית**: ה-resolve של שכבת ה-infra
  **בלתי-תלוי** בחיבור בפועל שמבצע `resolveFinalUrl()` (שמשתמש
  ב-`fetch()` ולא חושף IP). לכן IP פרטי שהתגלה **רק** דרך שכבת ה-infra
  **לעולם לא** מפעיל `highConfidence` — רק ה-SSRF guard הקיים
  ב-`resolveFinalUrl()` (שעוצר *לפני* חיבור בפועל, ערבות אמיתית) יכול
  לעשות זאת.
- **`.catch()` הגנתי**: ה-promise של ה-infra נשאר "תלוי באוויר"
  (unawaited) כשה-danger path מחזיר תשובה מיידית — נוסף `.catch()`
  מפורש כדי שרג'קשן עתידי לא יקרוס את ה-process (אומת: Node 24 קורס
  על unhandled rejection, לא רק מזהיר).

---

## 🎨 עיצוב, נגישות, ופיצ'רי משתמש
- **Redesign מלא** לפי עיצוב מיובא מ-Claude Design: פלטה אחידה
  (`#EEF0F6`), כרטיס תוצאה מאוחד לשלושת המצבים, כפתור בדיקה מפורש,
  תפריט צד עם הורדות ל-iOS/Android, לוגו אמיתי בכל קבצי האייקון
  (במקום ברירת המחדל הגנרית של Expo). רקע/לוגו/badge משתנים דינמית
  לפי סטטוס התוצאה.
- **נגישות**: `accessibilityRole`/`accessibilityLabel` על כל אלמנט
  אינטראקטיבי, `accessibilityLiveRegion="polite"` על תוצאת הבדיקה כך
  שקורא מסך מכריז עליה אוטומטית, `hitSlop` על כפתורים קטנים.
- **מדיניות פרטיות**: דף ציבורי (`/privacy`) בעברית + הודעת fallback
  לקוראים לא-דוברי-עברית, מקושר מהתפריט ומה-footer.
- **תנאי שימוש**: מסך הסכמה חד-פעמי חוסם (App.js לא מרנדר את המסך
  הראשי לפני הסכמה), עם checkbox חובה.
- **דף `/download`**: נחיתה ציבורית עם כפתורי הורדה (מזהה אוטומטית
  iOS מול Android ומציג את הרלוונטי קודם).
- **Android share-intent**: שיתוף טקסט/קישור ישירות מאפליקציות אחרות
  לתוך Verify (רק ב-build native, לא ב-Expo Go/web).
- **באג שתוקן**: `animationType="fade"` על `<Modal>` גרם ל-DOM לא
  להתעדכן ב-react-native-web (ה-state התעדכן נכון, אבל ה-DOM נשאר
  תקוע). הוסר משלושת ה-Modal-ים באפליקציה; לשקול להחזיר רק אחרי
  שדרוג גרסת react-native-web.

---

## סטטוס טסטים
- **בקאנד**: 130/130 (`node test.mjs` מהשורש) — כולל heuristic v2,
  שכבת ה-infra (עם DNS/RDAP מדומים, בלי קריאות רשת אמיתיות בטסטים),
  ו-race pattern (מוודא ש-"danger" חוזר מהר בלי להמתין ל-infra תקוע).
- **extractUrls**: 15/15 (`node test-extract-urls.mjs` מתוך `mobile\`).
- **גרסת SDK**: Expo 54. תלויות עיקריות ב-mobile:
  `react-native-svg`, `expo-linear-gradient`, `expo-share-intent`,
  `@react-native-async-storage/async-storage`, `expo-updates`.
  תלויות עיקריות בבקאנד: `@upstash/ratelimit`, `@upstash/redis`,
  `psl`, `punycode`, `ipaddr.js`.

## מה עדיין לא נעשה / הצעד הבא
1. **בדיקה חד-פעמית שטרם בוצעה**: לוודא בפועל על מכשיר/אמולטור
   אנדרואיד שה-APK הנוכחי מתקין ופועל, ושעדכון JS-בלבד דרך
   `eas update --channel preview` באמת מגיע אליו.
2. Budget Alert בגוגל קלאוד — עדיין לא הוגדר.
3. חנויות אפליקציות רשמיות (App Store / Google Play) — לא נגענו,
   נדחה לטובת PWA + APK עצמאי. מדיניות הפרטיות/תנאי השימוש כבר קיימים
   כתשתית לכך, אך **טרם עברו עורך דין** — מומלץ לפני הגשה רשמית.
4. (לא דחוף) פרויקט Vercel מיותר "dist" (`dist-one-dun-68.vercel.app`)
   מתקופת מלכודת ה-`vercel link` — המשתמש בחר להשאיר בינתיים.
5. (לא דחוף, ממתין לאישור) מועמדים למחיקה: `extractUrls.js`,
   `translations.js`, `test-extract-urls.mjs` בשורש (עותקים ישנים
   ולא-בשימוש מלפני הפיצול ל-mobile/), ו-`mobile/LICENSE` (רישיון
   template של Expo, לא של הפרויקט).

## החלטות מפתח ולמה
- **Web Risk API, לא Safe Browsing v4** (מסחרי + לא deprecated).
- **Vercel Hobby (חינמי) מוגבל לשימוש לא-מסחרי** — לזכור אם עוברים
  למודל רווחים.
- **רגישות גבוהה לעלויות** — כל המלצה כדאי שתוביל בבדיקת "האם זה
  חינמי/יש חלופה חינמית". דוגמה: `psl`/`punycode`/`ipaddr.js` נבחרו
  על פני `tldts` (כבד פי 4) ועל פני שירותי reputation מסחריים.
- **`highConfidence` שמור אך ורק למקרים עם ערבות אמיתית** (private
  IP/raw IP/`@` בזרימה הקיימת, או SSRF guard שעוצר *לפני* חיבור) —
  שום שילוב של אותות חלשים, ואף לא IP פרטי שהתגלה ב-resolve עצמאי של
  שכבת ה-infra, לא מפעיל אותו. false positive נמוך > כיסוי אגרסיבי.
- **בלי גרדיאנטים מורכבים מדי / בלי ספריות פונט חיצוניות** — נשמר על
  הפונט הדיפולטי של המערכת כדי לא לסבך build נייטיבי.
- **המשתמש עובד ישירות עם Claude Code** על המחשב — הרשאות מלאות
  לעריכת קבצים, הרצת פקודות, והרצת דפדפן-תצוגה מקדימה
  (`.claude\launch.json`, קונפיגורציה `verify-app-web`: `cd mobile &&
  npx expo start --web`, פורט 8081).

## רעיונות להמשך (לא דחוף, לפי סדר עדיפות)
1. ASN / hosting infrastructure — רק אם נמצא מקור local קל-משקל, או
   בהחלטה מודעת להוסיף שירות חיצוני (Team Cymru DNS-based נשקל ונדחה
   בינתיים — לא IANA-backed, לא ודאי מספיק).
2. Caching אמיתי לתוצאות DNS/RDAP חוזרות — נדחה במכוון עד ש-Redis
   כבר "בתמונה" ממילא (rate limiting); in-memory cache על Vercel
   serverless נותן תועלת שולית מאוד (cold starts בלתי צפויים).
3. סריקת QR (הונאות "quishing") — מתחבר ישירות ל-`runCheck()` הקיים.
4. שמירת בחירת שפה בין הפעלות (AsyncStorage).
5. שדרוג `react-native`/`react-native-web` בעתיד ובדיקה אם אפשר
   להחזיר `animationType="fade"` ל-Modal-ים.
6. `waitUntil` (מ-`@vercel/functions`) — אומת שהוא זמין ב-Node.js
   Serverless Functions של Vercel (לא רק Edge), אך לא נוצל עדיין כי
   אין עדיין consumer לתוצאת infra שממשיכה ברקע אחרי תשובה מוקדמת.
