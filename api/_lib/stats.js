// api/_lib/stats.js
//
// Privacy-conscious usage counters, stored in the same Upstash Redis used
// for rate limiting (see api/check-link.js). Nothing here ever stores the
// checked link's content or a raw IP address — only aggregate numbers and
// a salted one-way hash of the IP (for same-day dedup only).

import crypto from 'crypto';

export const STATUSES = ['safe', 'danger', 'uncertain', 'unknown'];

export const TOTAL_KEY = 'stats:total';
export function statusKey(status) {
  return `stats:status:${status}`;
}
export function dauKey(dateStr) {
  return `stats:dau:${dateStr}`;
}

// Rough per-day unique-user sets are kept 90 days, then expire on their
// own — this is a coarse trend indicator, not a permanent user record.
const DAU_TTL_SECONDS = 60 * 60 * 24 * 90;

export function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function lastNDatesUTC(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// One-way, salted hash of the IP — we never store the raw IP anywhere.
// Salted with APP_SECRET when available so the hash isn't trivially
// reversible by brute-forcing the (small) IPv4 address space; falls back
// to a fixed, non-secret salt if APP_SECRET isn't configured, which is
// weaker but still never stores the IP itself.
function hashIp(ip) {
  const salt = process.env.APP_SECRET || 'verify-app-default-salt-not-secret';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

// Increments total + per-status counters and, if an IP was supplied, adds
// its hash to today's unique-visitor set. Best-effort: the caller decides
// what to do if this throws, but it should never be allowed to break the
// actual check response.
export async function recordCheck(redis, { status, ip }) {
  if (!redis) return;
  const statusField = STATUSES.includes(status) ? status : 'unknown';

  const tasks = [redis.incr(TOTAL_KEY), redis.incr(statusKey(statusField))];

  if (ip) {
    const key = dauKey(todayUTC());
    tasks.push(redis.sadd(key, hashIp(ip)).then(() => redis.expire(key, DAU_TTL_SECONDS)));
  }

  await Promise.all(tasks);
}
