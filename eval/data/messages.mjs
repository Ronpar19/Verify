// eval/data/messages.mjs
//
// Whole MESSAGES, as a person would paste or share them. Each goes through
// the same path as in the app: mobile/messageAnalysis.js reads the text on
// the "device", mobile/extractUrls.js finds the links, and every link is
// checked by the handler with only the derived identifiers.
//
//   text    the message
//   chain   optional: { '<link as written>': ['hop', ..., 'destination'] }
//   timeout optional: the first hop of every link times out (Israeli
//           banks and gov sites often drop non-Israeli traffic)
//
// Legitimate messages are the ones that must NOT turn red: real-style
// messages from the bodies themselves, and everyday messages that merely
// MENTION a bank, a card or a carrier. All made up; any resemblance to a
// real customer message is in the pattern only.

export const LEGIT_MESSAGES = {
  'from-the-body': [
    { text: 'בנק הפועלים: הודעה חדשה ממתינה לך באתר. לצפייה היכנסו https://login.bankhapoalim.co.il' },
    { text: 'בנק לאומי: הכרטיס החדש שלך נשלח. למעקב היכנסו https://www.leumi.co.il/he/cards' },
    { text: 'דואר ישראל: החבילה שלך RR123456789IL ממתינה לך בסניף. לפרטים https://israelpost.co.il/itemtrace?itemcode=RR123456789IL' },
    { text: 'דואר ישראל: החבילה שלך בדרך. לתיאום מסירה: https://bit.ly/3dRw', chain: { 'https://bit.ly/3dRw': ['https://mypost.israelpost.co.il/delivery/abc'] } },
    { text: 'ביטוח לאומי: התשלום לחודש נובמבר הועבר לחשבונך. לפרטים באזור האישי https://ps.btl.gov.il' },
    { text: 'רשות המסים: התקבלה בקשתך להחזר מס. לצפייה בסטטוס היכנסו https://www.gov.il/he/service/income-tax-refund' },
    { text: 'חברת החשמל: החשבון שלך לתקופה האחרונה מוכן. לתשלום היכנסו https://www.iec.co.il/pay-bill' },
    { text: 'ישראכרט: חיוב בסך 230 ש"ח בכרטיס המסתיים ב-1234. לפרטים https://digital.isracard.co.il' },
    { text: 'Israel Post: your parcel RR123456789IL is waiting at the branch. Details: https://israelpost.co.il/itemtrace' },
    { text: 'Netflix: your payment failed. Update your payment method at https://www.netflix.com/YourAccount' },
    { text: 'Your Amazon package could not be delivered. Reschedule: https://www.amazon.com/gp/your-account/order-history' },
    { text: 'מכבי שירותי בריאות: תזכורת לתור מחר ב-10:00. לביטול לחצו https://www.maccabi4u.co.il' },
    { text: 'כללית: תוצאות הבדיקה שלך זמינות. לצפייה היכנסו לאתר https://e-services.clalit.co.il' },
    { text: 'סלקום: החשבונית החודשית שלך מוכנה. לצפייה https://www.cellcom.co.il/production/Private/1/billing/' },
    { text: 'פיקוד העורף: עדכון הנחיות. לפרטים https://www.oref.org.il' },
    { text: 'בנק דיסקונט: לעדכון פרטי הקשר שלך היכנסו לאתר https://start.telebank.co.il/login' },
    { text: 'ביט: קיבלת 50 ש"ח מדני. לצפייה באפליקציית ביט https://www.bitpay.co.il/app/me/3A7B' },
    { text: 'בנק הפועלים: בקשת תשלום בביט ממתינה לך https://www.bitpay.co.il/app/x' },
    { text: 'מקורות: הודעה על הפסקת מים מתוכננת. לפרטים https://www.mekorot.co.il' },
    { text: 'Банк Апоалим: новое сообщение в личном кабинете. Войдите https://login.bankhapoalim.co.il' },
    { text: 'بنك لئومي: بطاقتك الجديدة في الطريق. للمتابعة ادخل https://www.leumi.co.il' },
    { text: 'La Poste israélienne : votre colis vous attend. Détails sur https://israelpost.co.il/itemtrace' },
  ],
  // The body itself, but the link cannot be followed from abroad: the
  // answer may be a caution, never red.
  'from-the-body-unreachable': [
    { text: 'בנק הפועלים: הודעה חדשה ממתינה לך. לצפייה https://bit.ly/3hpX', timeout: true },
    { text: 'ביטוח לאומי: עדכון בזכאות. לפרטים לחצו https://tinyurl.com/btl123', timeout: true },
    { text: 'דואר ישראל: תיאום מסירה לחבילה שלך https://bit.ly/post7', timeout: true },
  ],
  // Messages that only MENTION a body.
  'mentions-only': [
    { text: 'היי, בנק לאומי העלו שוב עמלות, תקראו https://www.ynet.co.il/economy/article/abc' },
    { text: 'אפשר לשלם בביט או בפייבוקס, להזמנה בקישור https://www.pizza-hakikar.co.il/order' },
    { text: 'מבצע! עד 12 תשלומים בכרטיסי ישראכרט, כאל ומקס. להזמנה היכנסו https://www.sofa-plus.co.il' },
    { text: 'תעבירו לי בביט 40 ש"ח על המתנה, הנה הרשימה https://docs.google.com/spreadsheets/d/1abc' },
    { text: 'ראית את הכתבה על הונאות דואר ישראל? https://www.mako.co.il/news-money/consumer/Article-123' },
    { text: 'הספר שביקשת, הזמנתי באמזון: https://www.goodreads.com/book/show/1234' },
    { text: 'I paid with PayPal, here is the receipt from the shop https://www.etsy.com/your/purchases/123' },
    { text: 'סלקום הורידו מחירים, ההשוואה פה https://www.zap.co.il/compare' },
    { text: 'מחר בעשר בסניף של בנק מזרחי ליד הבית, נפגש? המיקום https://maps.app.goo.gl/AbCdEf' },
    { text: 'החבילה שלך מאלי אקספרס הגיעה אצלי, תעבור לקחת. בינתיים תסתכל https://www.youtube.com/watch?v=abc' },
    { text: 'נטפליקס העלו מחיר, יש כתבה https://www.calcalist.co.il/consumer/article/abc' },
    { text: 'שלום, מצורף קישור לחשבונית מהמספרה. אפשר לשלם בביט https://pay.hair-studio.co.il/inv/1' },
    { text: 'הגן מזכיר: תשלום על הטיול עד יום ה׳ בפייבוקס, פרטים בקישור https://www.gan-hadekel.co.il/trip' },
    { text: 'Leumi raised interest rates again, see https://www.globes.co.il/news/article.aspx?did=1' },
    { text: 'Вот статья о мошенничестве от имени Почты Израиля https://www.timesofisrael.com/x' },
    { text: 'هذا الرابط لمقال عن احتيال باسم بنك لئومي https://www.haaretz.com/x' },
    { text: 'כביש 6 פקוק, תיסע דרך 4. מפה: https://www.waze.com/ul?ll=32.08,34.78' },
    { text: 'משלוח עד הבית בחינם בהזמנה מעל 200 ש"ח! לחנות https://www.terminalx.com/sale' },
    { text: 'תזכורת: תור לרופא שיניים ביום ב. לאישור הגעה לחצו https://www.dr-cohen-dental.co.il/confirm' },
    { text: 'קוד האימות שלך הוא 482193. אין להעביר קוד זה לאף אחד.' },
  ],
  // Found by the independent security review: each of these used to come
  // back "danger". Kept as permanent regression cases.
  'review-found': [
    { text: 'קיבלת מתנה! שובר BUYME בסך 200 ₪ למימוש בשופרסל, סופר-פארם ורמי לוי https://www.buyme.co.il/giftcard/123' },
    { text: 'הורים יקרים, ההגרלה לטיול תתקיים מחר. תשלום דרך אפליקציית ביט או כאן https://www.school-trip.co.il/pay' },
    { text: 'Electra Power: קבלו זיכוי בסך 100 ₪ במעבר מחברת החשמל https://www.electra-power.co.il/join' },
    { text: 'כתבה: ביטוח לאומי – מי זכאי להחזר מס השנה? https://www.bizportal.co.il/article/1' },
    { text: 'Статья: Битуах Леуми — кому положен возврат налога https://www.vesty.co.il/article/1' },
    { text: 'החבילה שלך מעליאקספרס מעוכבת במכס. למעקב: https://global.cainiao.com/detail.htm?mailNoList=LP001' },
    { text: 'مكابي حيفا: غرامة على النادي https://www.panet.co.il/article/1' },
    { text: 'HMRC: your National Insurance contributions are unpaid https://www.gov.uk/pay-national-insurance' },
    { text: 'ועד הבית: אסיפה כללית ביום ראשון. יתרת חוב לדירה 4 – פרטים בטופס https://forms.gle/AbC123' },
    { text: 'תשלום לטיול השנתי: הזינו את הקוד שקיבלתם בפלאפון באתר https://www.school-pay.co.il/' },
    { text: 'מבצע בזק! הגרלה על אייפון לכל המזמינים היום https://www.myshop.co.il/sale' },
    { text: 'ועד הפועלים: זכיתם בהגרלה לנופש! הפרטים כאן https://www.vaad-ovdim.co.il/nofesh' },
    { text: 'תקנון בית הספר: התנהגות בדרך ארץ חובה, איחור חוזר יגרור קנס https://www.school-rules.org.il/' },
    { text: 'החברה מתייחסת לאיחור בתשלום כאל חוב פתוח, פרטים https://www.landlord-info.co.il/terms' },
    { text: 'Доктор Мизрахи: у вас неоплаченный счёт за приём https://www.dr-mizrahi-clinic.co.il/pay' },
    { text: 'Administration fiscale : vous avez droit à un remboursement https://www.impots.gouv.fr/' },
    { text: 'Налоговая служба: вам положен возврат налога https://www.nalog.gov.ru/' },
    { text: 'Ministry of Transport: unpaid fine notice, see https://www.gov.uk/pay-dvla-fine' },
    { text: 'DHL: your parcel is held at customs, pay the duty at https://mydhl.express.dhl/il/en/help.html' },
    { text: 'Microsoft: your account will be suspended, read more https://aka.ms/accountsecurity' },
  ],
  // Written AFTER the rules were tuned and never used to tune them: the
  // honest false-alarm estimate. Do not special-case these.
  'holdout': [
    { text: 'שלום, זה יוסי מהמוסך. הרכב מוכן, אפשר לשלם בביט או במזומן. הקבלה כאן https://www.garage-yossi.co.il/r/551' },
    { text: 'הודעה מהוועד: תשלום ועד הבית לחודש הבא דרך פייבוקס, הקבוצה כאן https://www.vaad-bayit.co.il/pay' },
    { text: 'תזכורת מהמכון: אימון מחר ב-7. לביטול היכנסו https://www.studio-fit.co.il/cancel' },
    { text: 'דואר ישראל העלה את מחירי המשלוח לחו"ל, ראיתם? https://www.ynet.co.il/economy/article/xyz' },
    { text: 'בנק הפועלים פתחו סניף חדש ליד העבודה, הנה המיקום https://maps.app.goo.gl/XyZ123' },
    { text: 'אחי, תעביר לי בביט את החלק שלך בחשבון, צירפתי תמונה https://photos.app.goo.gl/AbC' },
    { text: 'יש מבצע בשופרסל על חיתולים, תסתכלי https://www.shufersal.co.il/online/he/A0101' },
    { text: 'הזמנתי לך את המטען מעלי אקספרס, זה הלינק להזמנה https://www.aliexpress.com/item/1005.html' },
    { text: 'Hi! Your appointment with Dr. Levi is confirmed for Sunday. Manage it here https://www.clinic-levi.co.il/appt' },
    { text: 'Did you see this about PayPal fees? https://techcrunch.com/2026/11/01/paypal-fees/' },
    { text: 'Our team lunch is on me, pay me back with Bit later. Menu: https://www.wolt.com/he/isr/tel-aviv/restaurant/x' },
    { text: 'מזל טוב! זכית במקום הראשון בתחרות הציור של בית הספר, התמונות כאן https://www.school-art.org.il/gallery' },
    { text: 'כללית מזכירים לחסן את הילדים, פרטים באתר משרד הבריאות https://www.health.gov.il/vaccines' },
    { text: 'מקס: עסקה בסך 120 ש"ח בכרטיסך המסתיים ב-4455 בשופרסל. לפרטים https://www.max.co.il' },
    { text: 'ביטוח לאומי - אישור על הגשת התביעה התקבל. לצפייה באזור האישי https://www.btl.gov.il/' },
    { text: 'נטפליקס: נכנסו לחשבונך ממכשיר חדש. אם זה לא את/ה, היכנסו להגדרות https://www.netflix.com/YourAccount' },
    { text: 'החשבונית שלך מבזק לחודש נובמבר זמינה לצפייה https://www.bezeq.co.il/myaccount' },
    { text: 'Рами Леви: скидки недели! Смотрите по ссылке https://www.rami-levy.co.il/he' },
    { text: 'شوفرسال: عروض نهاية الأسبوع على الرابط https://www.shufersal.co.il/online/he/' },
    { text: 'Votre colis Amazon a été livré. Voir la commande https://www.amazon.fr/gp/your-account/order-history' },
    { text: 'הודעה מהגן: נא להעביר את דמי הטיול בפייבוקס עד יום חמישי, הטופס כאן https://docs.google.com/forms/d/e/1FAIp/viewform' },
    { text: 'כביש 6: חשבונית לתקופה האחרונה זמינה לצפייה באתר https://www.kvish6.co.il' },
    { text: 'חברת החשמל מודיעה על הפסקת חשמל מתוכננת ברחוב. פרטים https://www.iec.co.il/outages' },
    { text: 'המסעדה שלנו עברה! מעכשיו אפשר להזמין גם בביט. האתר החדש https://www.hummus-abu.co.il' },
    { text: 'שלחתי לך את קובץ ההצעה מהבנק, תסתכל בבקשה https://drive.google.com/file/d/1AbC/view' },
  ],
};

export const SCAM_MESSAGES = {
  'claims-a-body': [
    { text: 'דואר ישראל: החבילה שלך ממתינה, יש להסדיר דמי משלוח 4.90 ש"ח בקישור: https://il-parcel-pay.com/rr' },
    { text: 'דואר ישראל: לא הצלחנו למסור את החבילה שלך. לתיאום מסירה חוזרת: https://delivery-reschedule.net/il' },
    { text: 'בנק הפועלים: זיהינו פעילות חריגה בחשבונך. לאימות היכנסו https://secure-check-session.com/a' },
    { text: 'בנק לאומי: חשבונך יוקפא תוך 24 שעות. לעדכון פרטים: https://client-verify-area.com/l' },
    { text: 'בנק דיסקונט: נדרש אימות זהות לחשבונך. היכנסו: https://online-auth-portal.net/d' },
    { text: 'ביטוח לאומי: מגיע לך החזר כספי בסך 2,310 ש"ח. לקבלת ההחזר: https://refund-claims-center.com/b' },
    { text: 'רשות המסים: את/ה זכאי/ת להחזר מס בסך 1,870 ש"ח. להשלמת הבקשה: https://tax-return-form.net/x' },
    { text: 'חברת החשמל: קיים חוב פתוח בחשבונך. החשמל ינותק תוך 48 שעות. להסדרה: https://bill-settle-now.com/e' },
    { text: 'כביש 6: חשבונית שלא שולמה בסך 37.50 ש"ח. להסדרת החוב: https://toll-invoice-pay.com/6' },
    { text: 'ישראכרט: הכרטיס שלך נחסם עקב פעילות חשודה. לשחרור: https://card-unlock-center.com/i' },
    { text: 'מקס: נדרש עדכון פרטי כרטיס. 3 הספרות בגב הכרטיס נדרשות לאימות: https://card-verify-app.com/m' },
    { text: 'כאל: חיוב חשוד בכרטיסך. אם לא ביצעת, בטל כאן תוך 24 שעות: https://cancel-charge-now.com/c' },
    { text: 'ביט: התקבלה העברה עבורך בסך 300 ש"ח. לקבלת הכסף הזן את הקוד שקיבלת: https://transfer-receive.app/b' },
    { text: 'פייבוקס: חשבונך הושעה. לעדכון פרטים: https://wallet-restore.net/p' },
    { text: 'משטרת ישראל: קנס על עבירת תנועה טרם שולם. לתשלום: https://fine-payment-center.com/p' },
    { text: 'משרד התחבורה: רישיון הרכב שלך יבוטל. לחידוש באופן מיידי: https://license-renew-online.com/t' },
    { text: 'כללית: נדרש אימות זהות לחשבון שלך. היכנסו: https://health-portal-verify.com/c' },
    { text: 'סלקום: יש לך חוב פתוח. השירות ינותק. לתשלום: https://bill-mobile-pay.com/c' },
    { text: 'מי אביבים: חוב בסך 180 ש"ח טרם שולם, יש להסדיר: https://water-bill-online.com/ma' },
    { text: 'Netflix: your payment failed. Update your details within 24 hours: https://billing-update-center.com/n' },
    { text: 'Amazon: your account has been suspended due to unusual activity. Verify: https://account-restore-help.com/a' },
    { text: 'Apple ID: your account is locked. Verify your identity: https://id-recovery-support.com/' },
    { text: 'DHL: your parcel is held at customs, customs fee 12.90 ILS: https://customs-release-pay.com/d' },
    { text: 'PayPal: unusual activity detected. Verify your account: https://resolution-center-help.com/p' },
    { text: 'WhatsApp support: send us the code you received to keep your account: https://wa-verify-help.com' },
    { text: 'Почта Израиля: ваша посылка ожидает, оплатите таможенный сбор по ссылке https://parcel-fee-il.com/r' },
    { text: 'Банк Апоалим: ваша карта будет заблокирована, подтвердите данные по ссылке https://secure-check-session.com/r' },
    { text: 'بنك لئومي: تم تعليق حسابك، قم بتحديث بياناتك عبر الرابط https://client-verify-area.com/ar' },
    { text: 'التأمين الوطني: أنت مستحق لاسترداد مبلغ 2000 شيكل عبر الرابط https://refund-claims-center.com/ar' },
    { text: 'La Poste israélienne : votre colis est en attente, frais de livraison 3,90 ILS : https://colis-attente.com/fr' },
    { text: 'Bituach Leumi : vous avez droit à un remboursement. Cliquez sur le lien https://refund-claims-center.com/fr' },
    // A body's name, and the link is a shortener to a scam site.
    { text: 'דואר ישראל: החבילה שלך מעוכבת, לתשלום דמי שחרור https://bit.ly/3scm', chain: { 'https://bit.ly/3scm': ['https://parcel-release-fee.com/x'] } },
    // Naming a second body must not clear the first one's mismatch.
    { text: 'בנק לאומי: חשבונך ייחסם. אמתו כאן, ואמתו גם את חשבון גוגל שלכם https://sites.google.com/view/leumi-secure' },
    { text: 'Microsoft: your account will be suspended. Verify: https://forms.office.com/r/AbC' },
    // An open redirect on the body's own site, to an unknown one.
    { text: 'בנק לאומי: חשבונך ייחסם. לאימות https://www.leumi.co.il/go', chain: { 'https://www.leumi.co.il/go': ['https://leumi-verify-session.com/login'] } },
    // A known site that isn't the body's (a form on Google).
    { text: 'בנק לאומי: נדרש עדכון פרטים עד סוף היום. מלאו את הטופס https://docs.google.com/forms/d/e/1FAIpQ/viewform' },
  ],
  // Scam wording, no body named: the link-level checks plus the wording.
  'no-body-named': [
    { text: 'החבילה שלך ממתינה! יש לשלם דמי משלוח של 3.90 ש"ח: https://shipment-info.com/pay' },
    { text: 'זכית בהגרלה! קיבלת מתנה בשווי 1,000 ש"ח, לקבלה לחצו https://member-benefits.net/form' },
    { text: 'חוב פתוח בסך 49 ש"ח, יש להסדיר תוך 24 שעות למניעת עיקול: https://refunds-center.com/claim' },
    { text: 'Your package could not be delivered. Pay the redelivery fee: https://parcel-notice.com/t/8f3k' },
    { text: 'You have won a prize! Claim your reward now: https://digital-wallet-receive.com/' },
  ],
};
