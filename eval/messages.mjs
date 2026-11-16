// eval/messages.mjs -- message-level evaluation (on-device analysis + link check).
//   node eval/messages.mjs [--misses] [--no-gate]
// See eval/README.md. No network: same mocks as eval/run.mjs.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import handler, { __setHopRequestForTests, __setRatelimiterForTests } from '../api/check-link.js';
import { __setRedisForTests } from '../api/_lib/redis.js';
import { __setDnsForTests, __setRdapFetchForTests } from '../api/_lib/infrastructure.js';
import { analyzeMessage } from '../mobile/messageAnalysis.js';
import { extractUrls } from '../mobile/extractUrls.js';
import { LEGIT_MESSAGES, SCAM_MESSAGES } from './data/messages.mjs';

const args = new Set(process.argv.slice(2));
const thresholds = JSON.parse(readFileSync(fileURLToPath(new URL('./thresholds.json', import.meta.url)), 'utf8')).messages;
const normalize = (u) => { try { return new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u).toString(); } catch (e) { return u; } };
const SEVERITY = { safe: 0, uncertain: 1, unknown: 1, danger: 2 };

async function checkLink(link, msg, derived) {
  const chains = msg.chain || {};
  const hops = [normalize(link), ...((chains[link] || []).map(normalize))];
  const next = new Map(hops.slice(0, -1).map((h, i) => [h, hops[i + 1]]));
  __setHopRequestForTests(async (url) => {
    if (msg.timeout) throw Object.assign(new Error('timeout'), { code: 'EHOPTIMEOUT' });
    const to = next.get(normalize(url));
    return to ? { status: 302, headers: { get: (h) => (String(h).toLowerCase() === 'location' ? to : null) } } : { status: 200, headers: { get: () => null } };
  });
  const res = { _json: null, status() { return res; }, json(j) { res._json = j; return res; }, setHeader() {}, end() { return res; } };
  const body = { link, lang: 'he' };
  if (derived) Object.assign(body, derived);
  await handler({ method: 'POST', headers: {}, body }, res);
  return res._json;
}

async function runMessage(msg, useMessage) {
  const derived = useMessage ? analyzeMessage(msg.text) : null;
  const links = extractUrls(msg.text);
  let worst = 'safe', mismatch = false;
  for (const l of links) {
    const r = await checkLink(l, msg, derived);
    if (SEVERITY[r.status] > SEVERITY[worst]) worst = r.status === 'unknown' ? 'uncertain' : r.status;
    if (r.entityMismatch) mismatch = true;
  }
  return { status: links.length ? worst : 'no-link', derived, mismatch };
}

async function main() {
  process.env.GOOGLE_API_KEY = 'eval-key';
  delete process.env.APP_SECRET;
  __setRedisForTests(null);
  __setRatelimiterForTests(null);
  __setDnsForTests({ resolve4: async () => ['93.184.216.34'], resolve6: async () => [], resolveCname: async () => [], resolveMx: async () => [], resolveNs: async () => [] });
  __setRdapFetchForTests(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  global.fetch = async (url) => {
    if (String(url).startsWith('https://webrisk.googleapis.com/')) return { ok: true, json: async () => ({}) };
    throw new Error('eval: unexpected network call');
  };
  const realError = console.error; console.error = () => {};

  const rows = [];
  for (const [label, groups] of [['legit', LEGIT_MESSAGES], ['scam', SCAM_MESSAGES]]) {
    for (const [category, msgs] of Object.entries(groups)) {
      for (const msg of msgs) {
        const withMsg = await runMessage(msg, true);
        const linkOnly = await runMessage(msg, false);
        rows.push({ label, category, text: msg.text, withMsg, linkOnly });
      }
    }
  }
  console.error = realError;

  const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + '%' : '-');
  const legit = rows.filter((r) => r.label === 'legit' && r.withMsg.status !== 'no-link');
  const scam = rows.filter((r) => r.label === 'scam');
  const count = (list, f) => list.filter(f).length;
  const s = {
    legitRed: count(legit, (r) => r.withMsg.status === 'danger'),
    legitNotSafe: count(legit.filter((r) => r.category !== 'from-the-body-unreachable' && r.category !== 'review-found'), (r) => r.withMsg.status !== 'safe'),
    reviewNotSafe: count(legit.filter((r) => r.category === 'review-found'), (r) => r.withMsg.status !== 'safe'),
    reviewTotal: legit.filter((r) => r.category === 'review-found').length,
    legitReachable: legit.filter((r) => r.category !== 'from-the-body-unreachable' && r.category !== 'review-found').length,
    scamCaught: count(scam, (r) => r.withMsg.status !== 'safe'),
    scamRed: count(scam, (r) => r.withMsg.status === 'danger'),
    scamCaughtLinkOnly: count(scam, (r) => r.linkOnly.status !== 'safe'),
    scamRedLinkOnly: count(scam, (r) => r.linkOnly.status === 'danger'),
    holdoutRed: count(legit.filter((r) => r.category === 'holdout'), (r) => r.withMsg.status === 'danger'),
    holdoutNotSafe: count(legit.filter((r) => r.category === 'holdout'), (r) => r.withMsg.status !== 'safe'),
    holdoutTotal: legit.filter((r) => r.category === 'holdout').length,
    claimedBodyRed: count(scam.filter((r) => r.category === 'claims-a-body'), (r) => r.withMsg.status === 'danger'),
    claimedBodyTotal: scam.filter((r) => r.category === 'claims-a-body').length,
  };

  console.log(`Message evaluation: ${legit.length} legitimate messages with links, ${scam.length} scam messages\n`);
  console.log('                                      link only   with message analysis');
  console.log(`  Scam messages caught (not safe)       ${pct(s.scamCaughtLinkOnly, scam.length).padStart(9)}   ${pct(s.scamCaught, scam.length)}`);
  console.log(`  Scam messages marked DANGER           ${pct(s.scamRedLinkOnly, scam.length).padStart(9)}   ${pct(s.scamRed, scam.length)}`);
  console.log(`  ...of those claiming a body           ${''.padStart(9)}   ${s.claimedBodyRed}/${s.claimedBodyTotal}`);
  console.log(`  Legitimate messages marked DANGER     ${''.padStart(9)}   ${s.legitRed}/${legit.length}`);
  console.log(`  Legitimate (reachable) not "safe"     ${''.padStart(9)}   ${s.legitNotSafe}/${s.legitReachable}`);
  console.log(`  Review-found tricky legit: not "safe"  ${''.padStart(9)}   ${s.reviewNotSafe}/${s.reviewTotal} (scam-like wording -> "be careful", by design)`);
  console.log(`  ...held-out batch: danger / not safe  ${''.padStart(9)}   ${s.holdoutRed}/${s.holdoutTotal} / ${s.holdoutNotSafe}/${s.holdoutTotal}`);

  if (args.has('--misses')) {
    console.log('\nWrong or notable answers');
    for (const r of rows) {
      const bad = r.label === 'legit' ? (r.withMsg.status === 'danger' || (r.category !== 'from-the-body-unreachable' && r.withMsg.status !== 'safe')) : r.withMsg.status !== 'danger';
      if (bad) console.log(`  [${r.label}:${r.category}] ${r.withMsg.status.toUpperCase()} claimed=${JSON.stringify(r.withMsg.derived.claimedEntities)} flags=${JSON.stringify(r.withMsg.derived.messageFlags)}\n      ${r.text.slice(0, 110)}`);
    }
  }

  const failures = [];
  if (s.legitRed > thresholds.maxLegitRed) failures.push(`legitimate messages marked danger: ${s.legitRed} > ${thresholds.maxLegitRed}`);
  if (s.legitNotSafe > thresholds.maxLegitNotSafe) failures.push(`legitimate messages not safe: ${s.legitNotSafe} > ${thresholds.maxLegitNotSafe}`);
  if (s.scamCaught / scam.length < thresholds.minScamCaught) failures.push(`scam messages caught ${pct(s.scamCaught, scam.length)} < ${thresholds.minScamCaught * 100}%`);
  if (s.claimedBodyRed / s.claimedBodyTotal < thresholds.minClaimedBodyRed) failures.push(`claimed-body scams marked danger ${s.claimedBodyRed}/${s.claimedBodyTotal} < ${thresholds.minClaimedBodyRed * 100}%`);
  console.log('\n' + (failures.length ? 'GATE FAILED\n  ' + failures.join('\n  ') : 'GATE PASSED'));
  process.exit(failures.length && !args.has('--no-gate') ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
