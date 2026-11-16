// eval/run.mjs -- accuracy evaluation. Usage:
//   node eval/run.mjs              summary + pass/fail against eval/thresholds.json
//   node eval/run.mjs --misses     also list every wrong answer
//   node eval/run.mjs --json       machine-readable result on stdout
//   node eval/run.mjs --no-gate    never exit non-zero (just measure)
//
// Runs every labelled link in eval/data through the REAL handler
// (api/check-link.js) with the network mocked: redirects, DNS, RDAP and
// Google Web Risk all answer from the case's own description. No live
// calls, same seams test.mjs uses.
//
// What "Web Risk" says here: clean, for every link. The legitimate set
// measures false alarms; the phishing set measures what is caught before
// Google has listed a link. See eval/README.md for how to read the output.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import psl from 'psl';
import handler, { __setHopRequestForTests, __setRatelimiterForTests } from '../api/check-link.js';
import { __setRedisForTests } from '../api/_lib/redis.js';
import { __setDnsForTests, __setRdapFetchForTests } from '../api/_lib/infrastructure.js';
import { LEGIT } from './data/legit.mjs';
import { PHISHING } from './data/phishing.mjs';

const args = new Set(process.argv.slice(2));
const thresholds = JSON.parse(readFileSync(fileURLToPath(new URL('./thresholds.json', import.meta.url)), 'utf8'));

function toCases(groups, label) {
  const out = [];
  for (const [category, items] of Object.entries(groups)) {
    for (const item of items) {
      const c = typeof item === 'string' ? { url: item } : item;
      out.push({ ...c, category, label });
    }
  }
  return out;
}

const normalize = (u) => { try { return new URL(u).toString(); } catch (e) { return u; } };

// One case = one request through the handler, with its own little world.
async function runCase(c) {
  const start = normalize(/^https?:\/\//i.test(c.url) ? c.url : 'http://' + c.url);
  const hops = [start, ...(c.chain || []).map(normalize)];
  const next = new Map();
  for (let i = 0; i < hops.length - 1; i++) next.set(hops[i], hops[i + 1]);

  __setHopRequestForTests(async (url) => {
    const to = next.get(normalize(url));
    if (to) return { status: 302, headers: { get: (h) => (String(h).toLowerCase() === 'location' ? to : null) } };
    return { status: 200, headers: { get: () => null } };
  });
  // Public address for every name: nothing here is about private DNS.
  __setDnsForTests({
    resolve4: async () => ['93.184.216.34'],
    resolve6: async () => [],
    resolveCname: async () => [],
    resolveMx: async () => [],
    resolveNs: async () => ['ns1.example.net'],
  });
  // RDAP: an age only when the case states one; otherwise "no data" (which
  // is also the real situation for every .il domain).
  __setRdapFetchForTests(async () => {
    if (typeof c.ageDays !== 'number') return { ok: false, status: 404, json: async () => ({}) };
    const registered = new Date(Date.now() - c.ageDays * 86400000 - 3600000).toISOString();
    return { ok: true, json: async () => ({ events: [{ eventAction: 'registration', eventDate: registered }] }) };
  });
  global.fetch = async (url) => {
    if (String(url).startsWith('https://webrisk.googleapis.com/')) return { ok: true, json: async () => ({}) };
    throw new Error('eval: unexpected network call');
  };

  const res = { _json: null, status() { return res; }, json(j) { res._json = j; return res; }, setHeader() {}, end() { return res; } };
  await handler({ method: 'POST', headers: {}, body: { link: c.url, lang: 'en' } }, res);
  return res._json || { status: 'unknown', details: '' };
}

const isIsraeli = (c) => {
  if (c.category.startsWith('il-')) return true;
  try {
    const last = new URL(c.chain && c.chain.length ? c.chain[c.chain.length - 1] : c.url).hostname;
    return /\.il$/.test(last) || /\.xn--4dbrk0ce$/.test(last);
  } catch (e) { return false; }
};

async function main() {
  process.env.GOOGLE_API_KEY = 'eval-key';
  delete process.env.APP_SECRET;
  __setRedisForTests(null);
  __setRatelimiterForTests(null);
  const realError = console.error;
  console.error = () => {}; // the handler logs expected SSRF refusals etc.

  const cases = [...toCases(LEGIT, 'legit'), ...toCases(PHISHING, 'phish')];
  for (const c of cases) {
    const r = await runCase(c);
    c.status = r.status === 'uncertain' ? 'uncertain' : r.status; // safe | uncertain | danger | unknown
    c.details = r.details;
    if (c.label === 'legit') c.ok = c.status === 'safe';
    else c.ok = c.expect === 'danger' ? c.status === 'danger' : (c.status === 'uncertain' || c.status === 'danger');
  }
  console.error = realError;

  const count = (list, pred) => list.filter(pred).length;
  const legit = cases.filter((c) => c.label === 'legit');
  const phish = cases.filter((c) => c.label === 'phish');
  const legitIl = legit.filter(isIsraeli);
  const flagged = (c) => c.status !== 'safe';
  const tp = count(phish, flagged), fp = count(legit, flagged);
  const rate = (n, d) => (d ? n / d : 0);

  const confusion = {};
  for (const [name, list] of [['legit', legit], ['phish', phish]]) {
    confusion[name] = { safe: count(list, (c) => c.status === 'safe'), uncertain: count(list, (c) => c.status === 'uncertain'), danger: count(list, (c) => c.status === 'danger'), other: count(list, (c) => !['safe', 'uncertain', 'danger'].includes(c.status)) };
  }
  const byCategory = {};
  for (const c of cases) {
    const k = c.label + ':' + c.category;
    byCategory[k] = byCategory[k] || { label: c.label, category: c.category, total: 0, flagged: 0, danger: 0, wrong: 0 };
    byCategory[k].total++;
    if (flagged(c)) byCategory[k].flagged++;
    if (c.status === 'danger') byCategory[k].danger++;
    if (!c.ok) byCategory[k].wrong++;
  }

  const summary = {
    cases: { legit: legit.length, legitIsraeli: legitIl.length, phish: phish.length },
    falsePositiveRate: rate(fp, legit.length),
    falsePositiveRateIsraeli: rate(count(legitIl, flagged), legitIl.length),
    legitMarkedDanger: confusion.legit.danger,
    recall: rate(tp, phish.length),
    precision: rate(tp, tp + fp),
    hardRuleMisses: count(phish, (c) => c.expect === 'danger' && c.status !== 'danger'),
    confusion,
    byCategory: Object.values(byCategory),
  };

  const failures = [];
  const gate = (name, ok, text) => { if (!ok) failures.push(name + ': ' + text); };
  gate('falsePositiveRate', summary.falsePositiveRate <= thresholds.maxFalsePositiveRate, `${pct(summary.falsePositiveRate)} > ${pct(thresholds.maxFalsePositiveRate)}`);
  gate('falsePositiveRateIsraeli', summary.falsePositiveRateIsraeli <= thresholds.maxFalsePositiveRateIsraeli, `${pct(summary.falsePositiveRateIsraeli)} > ${pct(thresholds.maxFalsePositiveRateIsraeli)}`);
  gate('legitMarkedDanger', summary.legitMarkedDanger <= thresholds.maxLegitMarkedDanger, `${summary.legitMarkedDanger} > ${thresholds.maxLegitMarkedDanger}`);
  gate('recall', summary.recall >= thresholds.minRecall, `${pct(summary.recall)} < ${pct(thresholds.minRecall)}`);
  gate('hardRuleMisses', summary.hardRuleMisses <= thresholds.maxHardRuleMisses, `${summary.hardRuleMisses} > ${thresholds.maxHardRuleMisses}`);
  summary.gate = { passed: failures.length === 0, failures, thresholds };

  if (args.has('--json')) {
    console.log(JSON.stringify({ ...summary, wrong: cases.filter((c) => !c.ok).map((c) => ({ label: c.label, category: c.category, url: c.url, status: c.status })) }, null, 2));
  } else {
    print(summary, cases);
  }
  process.exit(!summary.gate.passed && !args.has('--no-gate') ? 1 : 0);
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function print(s, cases) {
  console.log(`Evaluation: ${s.cases.legit} legitimate links (${s.cases.legitIsraeli} Israeli), ${s.cases.phish} phishing patterns\n`);
  console.log('Confusion table (rows = truth, columns = answer)');
  console.log(pad('', 12) + padL('safe', 8) + padL('uncertain', 11) + padL('danger', 8) + padL('other', 7));
  for (const k of ['legit', 'phish']) {
    const r = s.confusion[k];
    console.log(pad(k, 12) + padL(r.safe, 8) + padL(r.uncertain, 11) + padL(r.danger, 8) + padL(r.other, 7));
  }
  console.log('\nHeadline numbers');
  console.log(`  False-positive rate, all legitimate      ${pct(s.falsePositiveRate)}`);
  console.log(`  False-positive rate, Israeli legitimate  ${pct(s.falsePositiveRateIsraeli)}`);
  console.log(`  Legitimate links marked DANGER           ${s.legitMarkedDanger}`);
  console.log(`  Recall (phishing not answered "safe")    ${pct(s.recall)}`);
  console.log(`  Precision (of everything flagged)        ${pct(s.precision)}`);
  console.log(`  Hard-rule cases not answered DANGER      ${s.hardRuleMisses}`);

  console.log('\nLegitimate, by category (flagged = false alarm)');
  for (const c of s.byCategory.filter((x) => x.label === 'legit')) {
    console.log('  ' + pad(c.category, 28) + padL(c.flagged + '/' + c.total, 8) + padL(pct(c.flagged / c.total), 8) + (c.danger ? `   (${c.danger} as danger)` : ''));
  }
  console.log('\nPhishing, by category (flagged = caught)');
  for (const c of s.byCategory.filter((x) => x.label === 'phish')) {
    console.log('  ' + pad(c.category, 28) + padL(c.flagged + '/' + c.total, 8) + padL(pct(c.flagged / c.total), 8) + `   (${c.danger} as danger)`);
  }

  if (args.has('--misses')) {
    console.log('\nWrong answers');
    for (const c of cases.filter((x) => !x.ok)) console.log(`  [${c.label}:${c.category}] ${c.status.toUpperCase()}  ${c.url}${c.label === 'legit' ? '\n      ' + c.details : ''}`);
  }
  console.log('\n' + (s.gate.passed ? 'GATE PASSED' : 'GATE FAILED\n  ' + s.gate.failures.join('\n  ')));
}

main().catch((err) => { console.error(err); process.exit(2); });
