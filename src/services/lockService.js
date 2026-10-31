/**
 * Redis Distributed Mutex (Redlock-lite)
 * 
 * Interview Concept: Prevents race conditions on shared mutable resources 
 * in distributed systems by using Redis SET NX EX as an atomic Compare-And-Set.
 * 
 * Why NX + EX together?
 *   - NX (Not eXists): Guarantees only one caller can write — atomic ownership claim.
 *   - EX (Expiry):     Auto-releases the lock if the holder crashes — prevents deadlocks.
 */

import redis from '../config/redis.js';
import { randomUUID } from 'crypto';

// Namespace all dispatch locks to avoid key collisions with other Redis data
const LOCK_PREFIX = 'lock:agent:';

// In-memory map to track lock tokens owned by this process.
// Prevents a process from releasing a lock it no longer owns
// (e.g., after TTL expiry + re-acquisition by another process).
const ownedLocks = new Map();

/**
 * Try to acquire an exclusive Redis lock on a resource.
 * 
 * @param {string} resourceKey  - e.g. 'agentId-uuid'
 * @param {number} ttlSeconds   - Auto-expire after N seconds (default: 5)
 * @returns {Promise<string|null>} Lock token if acquired, null if already locked.
 */
export async function acquireLock(resourceKey, ttlSeconds = 5) {
  const redisKey = `${LOCK_PREFIX}${resourceKey}`;
  const lockToken = randomUUID(); // Unique token per acquisition attempt

  // SET key token NX EX ttl — atomic: only sets if key does NOT exist
  const result = await redis.set(redisKey, lockToken, 'NX', 'EX', ttlSeconds);

  if (result === 'OK') {
    // We own this lock — store token to validate ownership on release
    ownedLocks.set(redisKey, lockToken);
    return lockToken;
  }

  return null; // Lock already held by another process
}

/**
 * Release a lock only if this process still owns it.
 * Prevents releasing a lock whose TTL expired and was re-acquired elsewhere.
 * 
 * @param {string} resourceKey - Must match the key used in acquireLock
 * @returns {Promise<boolean>} true if successfully released, false otherwise
 */
export async function releaseLock(resourceKey) {
  const redisKey = `${LOCK_PREFIX}${resourceKey}`;
  const ownedToken = ownedLocks.get(redisKey);

  if (!ownedToken) {
    // This process never acquired this lock
    return false;
  }

  // Verify we still own the lock before deleting (token must match)
  const currentToken = await redis.get(redisKey);
  if (currentToken !== ownedToken) {
    // Lock expired and was re-acquired by another process — do not delete
    ownedLocks.delete(redisKey);
    return false;
  }

  await redis.del(redisKey);
  ownedLocks.delete(redisKey);
  return true;
}

export default { acquireLock, releaseLock };

