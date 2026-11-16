import { analyzeMessage, normalizeText, entityName, ENTITIES, FLAGS, MESSAGE_FLAG_KEYS } from './messageAnalysis.js';
import { LANGUAGES } from './translations.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
const claims = (t) => analyzeMessage(t).claimedEntities;
const flags = (t) => analyzeMessage(t).messageFlags;

// 1. A message sent in a body's name, in each language.
for (const [text, id] of [
  ['בנק הפועלים: זיהינו פעילות חריגה בחשבונך. לאימות היכנסו https://x.com', 'bank-hapoalim'],
  ['הודעה מבנק הפועלים: חשבונך יוקפא', 'bank-hapoalim'],
  ['דואר ישראל: החבילה ממתינה, דמי משלוח 4.90', 'israel-post'],
  ['ביטוח לאומי: מגיע לך החזר כספי', 'bituach-leumi'],
  ['רשות המסים: את/ה זכאי/ת להחזר מס', 'tax-authority'],
  ['מקס: נדרש עדכון פרטי כרטיס', 'max'],
  ['ביט: הזן את הקוד שקיבלת', 'bit'],
  ['Israel Post: your parcel is on hold, pay the delivery fee', 'israel-post'],
  ['Netflix: your payment failed', 'netflix'],
  ['Банк Апоалим: ваша карта будет заблокирована', 'bank-hapoalim'],
  ['Почта Израиля: оплатите таможенный сбор', 'israel-post'],
  ['La Poste israélienne : frais de livraison à payer', 'israel-post'],
  ['بنك لئومي: تم تعليق حسابك', 'bank-leumi'],
  ['التأمين الوطني: أنت مستحق لاسترداد مبلغ', 'bituach-leumi'],
  ['בנק לאומי: לעדכון פרטים לחצו כאן', 'bank-leumi'],
]) {
  check(`claims ${id}: ${text.slice(0, 40)}`, claims(text)[0] === id, analyzeMessage(text));
}

// 2. Mentions that are NOT a claim -- each would otherwise risk a false "danger".
for (const text of [
  'היי, בנק לאומי העלו שוב עמלות, תקראו https://www.ynet.co.il/a',
  'אפשר לשלם בביט או בפייבוקס, להזמנה בקישור https://pizza.co.il',
  'מבצע! עד 12 תשלומים בכרטיסי ישראכרט, כאל ומקס. להזמנה היכנסו',
  'תעביר לי בביט 40 שקל',
  'max 3 per customer, click here',
  'yes, click the link',
  'I paid with PayPal, here is the receipt',
  'הספר שהזמנתי באמזון הגיע',
  'מחר בסניף של בנק מזרחי, נפגש?',
  'Leumi raised interest rates again',
  'מקס ואני נגיע בשמונה, לחצו על הקישור למפה',
]) {
  check(`no claim: ${text.slice(0, 40)}`, claims(text).length === 0, analyzeMessage(text));
}

// 2b. Found by the security review: a body mentioned mid-message, an
// everyday word, or a foreign body's generic name is never a claim.
for (const text of [
  'קיבלת מתנה! שובר BUYME בסך 200 ₪ למימוש בשופרסל, סופר-פארם ורמי לוי',
  'הורים יקרים, ההגרלה לטיול תתקיים מחר. תשלום דרך אפליקציית ביט או כאן',
  'Electra Power: קבלו זיכוי בסך 100 ₪ במעבר מחברת החשמל',
  'כתבה: ביטוח לאומי – מי זכאי להחזר מס השנה?',
  'ועד הבית: אסיפה כללית ביום ראשון. יתרת חוב לדירה 4',
  'תשלום לטיול השנתי: הזינו את הקוד שקיבלתם בפלאפון',
  'מבצע בזק! הגרלה על אייפון',
  'ועד הפועלים: זכיתם בהגרלה לנופש!',
  'תקנון: התנהגות בדרך ארץ חובה, איחור יגרור קנס',
  'מתייחסים לאיחור כאל חוב פתוח',
  'Доктор Мизрахи: у вас неоплаченный счёт',
  'Administration fiscale : vous avez droit à un remboursement',
  'Налоговая служба: вам положен возврат налога',
  'Ministry of Transport: unpaid fine notice',
  'HMRC: your National Insurance contributions are unpaid',
  'مكابي حيفا: غرامة على النادي',
]) {
  check(`review case, no claim: ${text.slice(0, 40)}`, claims(text).length === 0, analyzeMessage(text));
}
check('bare everyday word as the opening word still claims: "בזק:" + scam pattern', claims('בזק: החשבון שלך ייחסם תוך 24 שעות')[0] === 'bezeq', analyzeMessage('בזק: החשבון שלך ייחסם תוך 24 שעות'));
check('French elision handled', claims("L'administration fiscale israélienne : remboursement d'impôt à recevoir")[0] === 'tax-authority', analyzeMessage("L'administration fiscale israélienne : remboursement d'impôt à recevoir"));
{
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) { analyzeMessage('ab.1 '.repeat(1000)); analyzeMessage('a.'.repeat(2500)); }
  check('link stripping is linear on adversarial input', Date.now() - t0 < 400, Date.now() - t0);
}

// 3. National Insurance is never read as Bank Leumi; Leumit is not Leumi.
check('ביטוח לאומי -> bituach-leumi only', JSON.stringify(claims('ביטוח לאומי: מגיע לך החזר כספי')) === '["bituach-leumi"]', claims('ביטוח לאומי: מגיע לך החזר כספי'));
check('המוסד לביטוח לאומי -> bituach-leumi only', JSON.stringify(claims('המוסד לביטוח לאומי: החשבון שלך יוקפא')) === '["bituach-leumi"]');
check('קופת חולים לאומית -> leumit', claims('קופת חולים לאומית: נדרש אימות זהות')[0] === 'leumit', claims('קופת חולים לאומית: נדרש אימות זהות'));

// 4. Links in the text never make the claim.
check('a scam domain in the link is not a claim', claims('לחצו כאן לעדכון: https://bankhapoalim-login.com/x חשבון יוקפא').length === 0, analyzeMessage('לחצו כאן לעדכון: https://bankhapoalim-login.com/x חשבון יוקפא'));
check('a bare domain in the text is not a claim', claims('חשבונך יוקפא, היכנס leumi-verify.co.il').length === 0);

// 5. Flags.
check('parcel fee -> parcelHeld', flags('החבילה ממתינה, יש לשלם דמי משלוח').includes('parcelHeld'));
check('your package alone is not a flag', !flags('החבילה שלך בדרך אליך').includes('parcelHeld'), flags('החבילה שלך בדרך אליך'));
check('code request -> otpRequest', flags('שלחו את הקוד שקיבלתם').includes('otpRequest') || flags('שלח את הקוד').includes('otpRequest'));
check('card details -> paymentDetails', flags('נא להזין את 3 הספרות בגב הכרטיס').includes('paymentDetails'));
check('tax refund -> refund', flags('Tax refund of 230 ILS').includes('refund'));
check('within 24 hours -> urgency', flags('Act within 24 hours').includes('urgency'));
check('everyday text -> no flags', flags('נתראה מחר בשמונה, תביא את הספר').length === 0);
check('report is not a fine', !flags('הדוח השנתי מצורף').includes('debtOrFine'), flags('הדוח השנתי מצורף'));

// 6. Normalization: niqqud, direction marks, punctuation, case.
check('niqqud removed', normalizeText('בַּנְק') === ' בנק ');
check('direction marks removed', normalizeText('בנק‏ הפועלים') === ' בנק הפועלים ');
check('links removed', !normalizeText('see https://leumi.co.il/x now').includes('leumi'));
check('hyphen joins as space', claims('בנק-הפועלים: חשבונך יוקפא')[0] === 'bank-hapoalim');

// 7. The output is identifiers only -- never text from the message.
{
  const secret = 'סיסמה-סודית-מאוד 4580123412341234';
  const out = analyzeMessage('בנק הפועלים: חשבונך יוקפא. ' + secret);
  const json = JSON.stringify(out);
  check('output has only the two fields', Object.keys(out).sort().join() === 'claimedEntities,messageFlags', out);
  check('output never contains message text', !json.includes('סודית') && !json.includes('4580'), out);
  const ids = new Set(ENTITIES.map((e) => e.id));
  check('claims are known ids', out.claimedEntities.every((x) => ids.has(x)), out);
  check('flags are known keys', out.messageFlags.every((x) => MESSAGE_FLAG_KEYS.includes(x)), out);
  check('at most 3 bodies', analyzeMessage('בנק הפועלים בנק לאומי בנק דיסקונט ישראכרט סלקום: חשבונך יוקפא').claimedEntities.length <= 3);
}

// 8. Robustness: empty, huge, odd input.
check('empty -> nothing', JSON.stringify(analyzeMessage('')) === '{"claimedEntities":[],"messageFlags":[]}');
check('null -> nothing', analyzeMessage(null).claimedEntities.length === 0);
check('number -> nothing', analyzeMessage(12345).claimedEntities.length === 0);
{
  const big = ('בנק הפועלים ' + 'א'.repeat(50) + ' ').repeat(2000);
  const t0 = Date.now();
  analyzeMessage(big);
  check('very long text is fast', Date.now() - t0 < 500, Date.now() - t0);
}

// 9. Data: every entity has a name in every app language; ids unique.
const codes = LANGUAGES.map((l) => l.code);
for (const e of ENTITIES) {
  check(`${e.id}: name in every language`, codes.every((c) => typeof e.names[c] === 'string' && e.names[c].trim()), e.names);
  check(`${e.id}: has phrases`, Array.isArray(e.phrases) && e.phrases.length > 0);
}
check('entity ids unique', new Set(ENTITIES.map((e) => e.id)).size === ENTITIES.length);
check('flag keys unique', new Set(FLAGS.map((f) => f.key)).size === FLAGS.length);
check('entityName falls back to English', entityName('bank-hapoalim', 'xx') === 'Bank Hapoalim');
check('entityName unknown -> null', entityName('nope', 'he') === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
