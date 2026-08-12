// api/_lib/redis.js
//
// Shared Upstash Redis client, lazily built once per warm serverless
// instance. Used by both api/check-link.js (rate limiting + stats
// counters) and api/stats.js (reading those counters) — one Redis
// database, no second external service.
//
// The underscore-prefixed `_lib` folder is a Vercel convention: files
// under it are never turned into routes, unlike everything else in api/.

import { Redis } from '@upstash/redis';

let redisInstance; // undefined = not attempted yet, null = unavailable
let redisOverride = null; // test-only seam, see __setRedisForTests

// Test-only hook: lets test.mjs inject a fake Redis-shaped object (with
// incr/sadd/expire/get/scard methods) so stats recording and reading can
// be exercised without a real Redis.
export function __setRedisForTests(fakeRedis) {
  redisOverride = fakeRedis;
}

export function getRedis() {
  if (redisOverride) return redisOverride;
  if (redisInstance !== undefined) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisInstance = null;
    return null;
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}
