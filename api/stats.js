// api/stats.js
//
// GET /api/stats — returns aggregate usage counters (never link content,
// never raw IPs). Protected by STATS_SECRET, a private value that must
// NEVER be reused from APP_SECRET (see check-link.js): APP_SECRET is
// inlined into the mobile app bundle and anyone who decompiles the app
// could extract it, which would also hand them access to these stats.
// STATS_SECRET only ever lives server-side and in your own notes.
//
// Auth: pass it as either `?secret=...` (convenient for opening directly
// in a browser) or an `x-stats-secret` header (for scripts/curl).

import { getRedis } from './_lib/redis.js';
import { STATUSES, TOTAL_KEY, statusKey, dauKey, lastNDatesUTC } from './_lib/stats.js';

const MAX_DAYS = 30;
const DEFAULT_DAYS = 7;

function isAuthorized(req) {
  const expected = process.env.STATS_SECRET;
  if (!expected) return false; // unlike check-link's APP_SECRET, this must be configured to work at all
  const provided = (req.headers && req.headers['x-stats-secret']) || (req.query && req.query.secret);
  return provided === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({ error: 'Stats storage is not configured (UPSTASH_REDIS_REST_URL/TOKEN missing)' });
  }

  const requestedDays = parseInt((req.query && req.query.days) || DEFAULT_DAYS, 10);
  const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : DEFAULT_DAYS, 1), MAX_DAYS);
  const dates = lastNDatesUTC(days);

  try {
    const [total, ...rest] = await Promise.all([
      redis.get(TOTAL_KEY),
      ...STATUSES.map((s) => redis.get(statusKey(s))),
      ...dates.map((d) => redis.scard(dauKey(d))),
    ]);

    const statusCounts = rest.slice(0, STATUSES.length);
    const dayCounts = rest.slice(STATUSES.length);

    const byStatus = {};
    STATUSES.forEach((s, i) => {
      byStatus[s] = Number(statusCounts[i]) || 0;
    });

    const uniqueUsersByDay = {};
    dates.forEach((d, i) => {
      uniqueUsersByDay[d] = Number(dayCounts[i]) || 0;
    });

    return res.status(200).json({
      totalChecks: Number(total) || 0,
      byStatus,
      uniqueUsersByDay,
    });
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: 'Failed to read stats' });
  }
}
