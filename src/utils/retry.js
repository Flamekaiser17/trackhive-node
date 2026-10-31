/**
 * retry.js
 * High-resilience exponential backoff with full jitter for transient
 * cloud database (Supabase) and Redis network glitches.
 */

/**
 * @param {Function} fn - Async operation to execute
 * @param {Object} options - Retry parameters
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelayMs=100] - Base delay in milliseconds
 * @param {number} [options.maxDelayMs=3000] - Maximum delay ceiling in milliseconds
 * @param {Function} [options.shouldRetry] - Predicate whether the caught error is retryable
 * @returns {Promise<any>}
 */
export async function withExponentialBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 3000,
    shouldRetry = () => true,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Full Jitter: Sleep between 0 and min(maxDelay, baseDelay * 2^(attempt-1))
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * exponentialDelay);

      console.warn(
        `[Retry] Transient failure on attempt ${attempt}/${maxRetries}. Retrying in ${jitterDelay}ms... (${error.message})`
      );
      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}

export default withExponentialBackoff;
