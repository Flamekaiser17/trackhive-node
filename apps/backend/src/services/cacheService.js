/**
 * cacheService.js
 * High-performance Read-Through Cache with Redis + In-Memory Fallback.
 * Ideal for high-frequency admin polling and API query offloading.
 */

import redis from '../config/redis.js';

// Fast In-Memory Fallback Map (LRU-like with expiration)
const memoryCache = new Map();

/**
 * Get cached value or fetch fresh data and store with TTL.
 *
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - Time-To-Live in seconds (e.g., 10s)
 * @param {Function} fetcherFn - Async function returning fresh data
 * @returns {Promise<any>}
 */
export async function getOrSetCache(key, ttlSeconds, fetcherFn) {
  const now = Date.now();

  // 1. Check in-memory local cache first (< 0.1ms)
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiry > now) {
    return memEntry.data;
  }

  // 2. Try Upstash Redis Cache (read-through)
  try {
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Populate memory cache for sub-millisecond future hits
      memoryCache.set(key, { data: parsed, expiry: now + ttlSeconds * 1000 });
      return parsed;
    }
  } catch (err) {
    // Redis network failure graceful degrade to direct DB
  }

  // 3. Fetch fresh data from DB
  const freshData = await fetcherFn();

  // 4. Update memory cache immediately
  memoryCache.set(key, { data: freshData, expiry: now + ttlSeconds * 1000 });

  // 5. Asynchronously persist to Redis in background (non-blocking)
  redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds).catch(() => {});

  return freshData;
}

/**
 * Invalidate specific cache keys or key patterns.
 *
 * @param {string|string[]} keys - Key or array of keys to clear
 */
export async function invalidateCache(keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const k of keyList) {
    memoryCache.delete(k);
  }

  try {
    if (keyList.length > 0) {
      await redis.del(...keyList);
    }
  } catch {
    // Non-blocking catch
  }
}

export default { getOrSetCache, invalidateCache };

