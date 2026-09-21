// terms.js
//
// Consent-screen copy. Bumping TERMS_VERSION (and therefore TERMS_KEY)
// forces every user — even ones who already accepted an older version —
// to see and re-accept the screen once, the next time they open the app.
//
// The Hebrew text (`he`) is the author-provided original and the only
// legally authoritative version. The `en`/`ru`/`fr`/`ar` bodies below are
// translations of it, kept as close to the original clause-by-clause
// meaning as possible (limitation of liability, indemnification,
// governing law, etc.) — but they are translations, not independently
// drafted legal text, and have not been reviewed by counsel in those
// jurisdictions. Have a lawyer review them before relying on them as
// legally binding in a given language/jurisdiction; until then the
// Hebrew original governs in case of any discrepancy.

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

const TERMS_BODY_EN = `Before using the app, please read the following terms carefully. Use of the app constitutes full agreement to everything stated below.

1. Nature of the Service
Verify is an application that provides only a preliminary, technical assessment of the potential risk level of a link (URL). The assessment is based on a combination of checks against external third-party databases (including, among others, Google Web Risk) and automated heuristic analysis of the link's structure. The app does not examine the actual content of the website, and does not constitute a professional information-security system.

2. No Guarantee of Accuracy
The check may produce an incorrect result in either direction:
(a) Marking a link as "safe" or "uncertain" when it is in fact a dangerous link — for example, a new phishing link not yet reported to the databases, a legitimate site that has been compromised, or a link crafted specifically and precisely to target the user.
(b) Marking a link as "dangerous" or "uncertain" when it is in fact a legitimate link.
The app's developer makes no representation or warranty whatsoever, express or implied, as to the accuracy, completeness, timeliness, or reliability of the result displayed.

3. The App Is Only a Helper Tool
The app is intended to serve as a supplementary aid to the user's own judgment, and is not a substitute for basic caution, independent verification, or refraining from clicking links from unfamiliar sources. The final decision whether to click a link, enter details on a website, or take any other action rests solely and entirely with the user.

4. Limitation of Liability
The app is provided "AS IS" and "AS AVAILABLE", without any warranty of any kind, express or implied. The app's developer, including anyone acting on its behalf, shall not be liable for any damage — direct, indirect, special, consequential, or otherwise — including but not limited to: financial loss, identity theft, data theft, damage to equipment, or any other damage, arising from the use of or reliance on the app, including as a result of an error in the assessment of any link, whether the damage was caused by a malfunction in the app, in third-party services it relies on, or for any other reason.

5. Indemnification
The user agrees to indemnify and hold harmless the app's developer against any claim, demand, damage, or expense (including attorneys' fees) arising from the user's use of the app or from a breach of these terms.

6. Third-Party Services
The app uses the Google Web Risk API service to check links against external databases. Use of this service is subject to Google's terms of use and privacy policy, and the app's developer is not responsible for the availability, accuracy, or proper functioning of third-party services.

7. Privacy
The app does not store the content of links checked by users for personal identification purposes, and does not collect identifying information beyond what is required for the basic technical operation of the service and anonymous statistical metrics (such as the total number of checks).

8. Changes to These Terms
The app's developer may update these terms from time to time. Continued use of the app after such an update constitutes agreement to the updated terms.

9. Governing Law and Jurisdiction
These terms shall be governed solely by the laws of the State of Israel, and exclusive jurisdiction over any dispute relating to these terms or to the use of the app shall be vested in the competent courts of the State of Israel.

10. Acknowledgment
By tapping "I have read and agree" and by continuing to use the app, I confirm that I have read, understood, and agree to everything stated above.`;

const TERMS_BODY_RU = `Перед использованием приложения, пожалуйста, внимательно ознакомьтесь со следующими условиями. Использование приложения означает полное согласие со всем изложенным ниже.

1. Характер услуги
Verify — это приложение, которое предоставляет только предварительную, техническую оценку потенциального уровня риска ссылки (URL). Оценка основана на сочетании проверки по внешним базам данных третьих сторон (в том числе, среди прочего, Google Web Risk) и автоматического эвристического анализа структуры ссылки. Приложение не проверяет фактическое содержимое веб-сайта и не является профессиональной системой информационной безопасности.

2. Отсутствие гарантии точности
Проверка может дать неверный результат в обоих направлениях:
(а) пометить ссылку как «безопасную» или «неопределённую», хотя на самом деле речь идёт об опасной ссылке — например, о новой фишинговой ссылке, ещё не внесённой в базы данных, о легитимном сайте, который был взломан, или о ссылке, специально и точечно нацеленной именно на данного пользователя;
(б) пометить ссылку как «опасную» или «неопределённую», хотя на самом деле речь идёт о безопасной ссылке.
Разработчик приложения никоим образом не гарантирует, прямо или косвенно, точность, полноту, актуальность или достоверность отображаемого результата.

3. Приложение — лишь вспомогательный инструмент
Приложение предназначено служить дополнительным вспомогательным средством для собственного суждения пользователя и не заменяет базовую осторожность, самостоятельную проверку или отказ от перехода по ссылкам из незнакомых источников. Окончательное решение о том, переходить ли по ссылке, вводить ли данные на сайте или совершать любое иное действие, лежит исключительно и полностью на самом пользователе.

4. Ограничение ответственности
Приложение предоставляется «как есть» (AS IS) и «по мере доступности» (AS AVAILABLE), без каких-либо гарантий любого рода, явных или подразумеваемых. Разработчик приложения, включая всех действующих от его имени лиц, не несёт ответственности за какой-либо ущерб — прямой, косвенный, специальный, побочный (вытекающий) или иной — включая, помимо прочего: финансовые потери, кражу личных данных, кражу информации, повреждение оборудования или любой иной ущерб, возникший в результате использования приложения или доверия к нему, в том числе в результате ошибки в оценке какой-либо ссылки, независимо от того, был ли ущерб вызван сбоем в приложении, в сторонних сервисах, на которые оно опирается, или по любой иной причине.

5. Возмещение убытков
Пользователь соглашается возместить и оградить от ответственности разработчика приложения в отношении любых претензий, требований, убытков или расходов (включая гонорары адвокатов), возникающих в результате использования пользователем приложения или нарушения настоящих условий.

6. Услуги третьих лиц
Приложение использует сервис Google Web Risk API для проверки ссылок по внешним базам данных. Использование этого сервиса регулируется условиями использования и политикой конфиденциальности Google, и разработчик приложения не несёт ответственности за доступность, точность или исправную работу сервисов третьих лиц.

7. Конфиденциальность
Приложение не сохраняет содержимое проверяемых пользователями ссылок в целях личной идентификации и не собирает идентифицирующую информацию сверх того, что необходимо для базовой технической работы сервиса и анонимных статистических показателей (таких как общее количество проверок).

8. Изменения в настоящих условиях
Разработчик приложения может время от времени обновлять настоящие условия. Дальнейшее использование приложения после такого обновления означает согласие с обновлёнными условиями.

9. Применимое право и юрисдикция
Настоящие условия регулируются исключительно законодательством Государства Израиль, и исключительная юрисдикция в отношении любого спора, связанного с настоящими условиями или использованием приложения, принадлежит компетентным судам Государства Израиль.

10. Подтверждение
Нажимая «Я прочитал(а) и согласен(на)» и продолжая использовать приложение, я подтверждаю, что прочитал(а), понял(а) и согласен(на) со всем вышеизложенным.`;

const TERMS_BODY_FR = `Avant d'utiliser l'application, veuillez lire attentivement les conditions suivantes. L'utilisation de l'application vaut acceptation pleine et entière de tout ce qui est énoncé ci-dessous.

1. Nature du service
Verify est une application qui fournit uniquement une évaluation préliminaire et technique du niveau de risque potentiel d'un lien (URL). Cette évaluation repose sur une combinaison de vérifications auprès de bases de données externes de tiers (notamment, entre autres, Google Web Risk) et d'une analyse heuristique automatisée de la structure du lien. L'application n'examine pas le contenu réel du site web et ne constitue pas un système professionnel de sécurité de l'information.

2. Absence de garantie d'exactitude
La vérification peut produire un résultat erroné dans les deux sens :
(a) signaler un lien comme « sûr » ou « incertain » alors qu'il s'agit en réalité d'un lien dangereux — par exemple un nouveau lien d'hameçonnage pas encore signalé dans les bases de données, un site légitime qui a été compromis, ou un lien conçu de manière ciblée et spécifique contre l'utilisateur ;
(b) signaler un lien comme « dangereux » ou « incertain » alors qu'il s'agit en réalité d'un lien légitime.
Le développeur de l'application ne garantit, ni expressément ni implicitement, en aucune manière, l'exactitude, l'exhaustivité, l'actualité ou la fiabilité du résultat affiché.

3. L'application n'est qu'un outil d'aide
L'application est destinée à servir d'aide complémentaire au jugement de l'utilisateur, et ne remplace ni la prudence de base, ni une vérification indépendante, ni l'abstention de cliquer sur des liens provenant de sources inconnues. La décision finale de cliquer ou non sur un lien, de saisir des informations sur un site web, ou d'accomplir toute autre action, relève de la seule et entière responsabilité de l'utilisateur.

4. Limitation de responsabilité
L'application est fournie « telle quelle » (AS IS) et « selon sa disponibilité » (AS AVAILABLE), sans garantie d'aucune sorte, expresse ou implicite. Le développeur de l'application, y compris toute personne agissant en son nom, ne pourra être tenu responsable d'aucun dommage — direct, indirect, spécial, consécutif ou autre — y compris, sans s'y limiter : perte financière, usurpation d'identité, vol de données, dommage matériel, ou tout autre préjudice, résultant de l'utilisation de l'application ou de la confiance qui lui est accordée, y compris à la suite d'une erreur dans l'évaluation d'un lien quelconque, que le dommage résulte d'un dysfonctionnement de l'application, des services tiers sur lesquels elle s'appuie, ou de toute autre cause.

5. Indemnisation
L'utilisateur accepte d'indemniser et de dégager de toute responsabilité le développeur de l'application contre toute réclamation, demande, dommage ou dépense (y compris les honoraires d'avocat) découlant de son utilisation de l'application ou d'une violation des présentes conditions.

6. Services tiers
L'application utilise le service Google Web Risk API pour vérifier les liens par rapport à des bases de données externes. L'utilisation de ce service est soumise aux conditions d'utilisation et à la politique de confidentialité de Google, et le développeur de l'application n'est pas responsable de la disponibilité, de l'exactitude ou du bon fonctionnement des services de tiers.

7. Confidentialité
L'application ne conserve pas le contenu des liens vérifiés par les utilisateurs à des fins d'identification personnelle, et ne collecte pas d'informations identifiantes au-delà de ce qui est nécessaire au fonctionnement technique de base du service et à des indicateurs statistiques anonymes (tels que le nombre total de vérifications).

8. Modifications des présentes conditions
Le développeur de l'application peut mettre à jour les présentes conditions de temps à autre. La poursuite de l'utilisation de l'application après une telle mise à jour vaut acceptation des conditions mises à jour.

9. Droit applicable et juridiction
Les présentes conditions sont exclusivement régies par le droit de l'État d'Israël, et la juridiction exclusive pour tout litige relatif aux présentes conditions ou à l'utilisation de l'application est attribuée aux tribunaux compétents de l'État d'Israël.

10. Confirmation
En appuyant sur « J'ai lu et j'accepte » et en continuant à utiliser l'application, je confirme avoir lu, compris et accepté tout ce qui précède.`;

const TERMS_BODY_AR = `قبل استخدام التطبيق، يُرجى قراءة الشروط التالية بعناية. يشكّل استخدام التطبيق موافقة كاملة على كل ما هو مذكور أدناه.

1. طبيعة الخدمة
Verify هو تطبيق يقدّم فقط تقييمًا أوليًا وتقنيًا لمستوى الخطورة المحتملة لرابط (URL). يستند هذا التقييم إلى مزيج من الفحص مقابل قواعد بيانات خارجية تابعة لجهات ثالثة (بما في ذلك، على سبيل المثال لا الحصر، Google Web Risk) وتحليل استكشافي (heuristic) آلي لبنية الرابط. لا يفحص التطبيق المحتوى الفعلي للموقع الإلكتروني، ولا يشكّل نظام أمن معلومات احترافي.

2. عدم وجود التزام بالدقة
قد يُسفر الفحص عن نتيجة غير صحيحة في كلا الاتجاهين:
(أ) تصنيف رابط على أنه "آمن" أو "غير مؤكد" بينما هو في الواقع رابط خطير — على سبيل المثال رابط تصيّد احتيالي جديد لم يُبلَّغ عنه بعد في قواعد البيانات، أو موقع شرعي تم اختراقه، أو رابط صُمّم خصيصًا وبشكل موجّه لاستهداف المستخدم.
(ب) تصنيف رابط على أنه "خطير" أو "غير مؤكد" بينما هو في الواقع رابط سليم.
لا يقدّم مطوّر التطبيق أي تعهد أو ضمان، صريح أو ضمني، بأي شكل من الأشكال، بشأن دقة النتيجة المعروضة أو اكتمالها أو حداثتها أو موثوقيتها.

3. التطبيق أداة مساعدة فقط
يهدف التطبيق إلى أن يكون أداة مساعدة تكميلية لتقدير المستخدم الخاص، وهو ليس بديلاً عن الحذر الأساسي، أو الفحص المستقل، أو الامتناع عن النقر على روابط من مصادر غير معروفة. يقع القرار النهائي بشأن النقر على رابط، أو إدخال بيانات في موقع إلكتروني، أو اتخاذ أي إجراء آخر، على عاتق المستخدم وحده وبشكل كامل.

4. تحديد المسؤولية
يُقدَّم التطبيق "كما هو" (AS IS) و"وفقًا لتوفره" (AS AVAILABLE)، دون أي ضمان من أي نوع، صريحًا كان أم ضمنيًا. لا يتحمّل مطوّر التطبيق، بما في ذلك أي شخص يعمل نيابة عنه، المسؤولية عن أي ضرر — مباشر أو غير مباشر أو خاص أو تبعي أو غير ذلك — بما في ذلك على سبيل المثال لا الحصر: الخسارة المالية، أو سرقة الهوية، أو سرقة البيانات، أو الضرر بالمعدات، أو أي ضرر آخر، ينشأ عن استخدام التطبيق أو الاعتماد عليه، بما في ذلك نتيجة خطأ في تقييم أي رابط، سواء نشأ الضرر عن عطل في التطبيق، أو في خدمات طرف ثالث يعتمد عليها، أو لأي سبب آخر.

5. التعويض
يوافق المستخدم على تعويض مطوّر التطبيق وإبرائه من أي مطالبة أو طلب أو ضرر أو نفقة (بما في ذلك أتعاب المحاماة) تنشأ عن استخدامه للتطبيق أو عن مخالفته لهذه الشروط.

6. خدمات الطرف الثالث
يستخدم التطبيق خدمة Google Web Risk API لفحص الروابط مقابل قواعد بيانات خارجية. يخضع استخدام هذه الخدمة لشروط استخدام وسياسة خصوصية Google، ولا يتحمّل مطوّر التطبيق مسؤولية توفر خدمات الأطراف الثالثة أو دقتها أو سلامة عملها.

7. الخصوصية
لا يحتفظ التطبيق بمحتوى الروابط التي يفحصها المستخدمون لأغراض التعريف الشخصي، ولا يجمع معلومات تعريفية تتجاوز ما هو ضروري للتشغيل التقني الأساسي للخدمة والمقاييس الإحصائية مجهولة الهوية (مثل إجمالي عدد عمليات الفحص).

8. التغييرات على هذه الشروط
يجوز لمطوّر التطبيق تحديث هذه الشروط من وقت لآخر. يُعدّ استمرار استخدام التطبيق بعد إجراء هذا التحديث موافقة على الشروط المحدَّثة.

9. القانون الحاكم والاختصاص القضائي
تخضع هذه الشروط حصريًا لقوانين دولة إسرائيل، وينعقد الاختصاص القضائي الحصري في أي نزاع يتعلق بهذه الشروط أو باستخدام التطبيق للمحاكم المختصة في دولة إسرائيل.

10. الإقرار
بالضغط على "قرأت وأوافق" وبمواصلة استخدام التطبيق، أقرّ بأنني قرأت وفهمت ووافقت على كل ما ورد أعلاه.`;

const TERMS_BODY = {
  he: TERMS_BODY_HE,
  en: TERMS_BODY_EN,
  ru: TERMS_BODY_RU,
  fr: TERMS_BODY_FR,
  ar: TERMS_BODY_AR,
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
