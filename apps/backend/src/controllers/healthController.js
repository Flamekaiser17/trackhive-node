import prisma from '../config/prisma.js';
import redis from '../config/redis.js';

// In-memory readiness state tracked passively on process lifetime
let dbReady = true;
let redisReady = true;

redis.on('ready', () => { redisReady = true; });
redis.on('connect', () => { redisReady = true; });
redis.on('error', () => { redisReady = false; });
redis.on('close', () => { redisReady = false; });

export const healthController = {
  /**
   * Ultra-Fast Liveness & Readiness Healthcheck Handler
   * - Default: Returns in < 2ms without blocking the event loop on remote roundtrips.
   * - ?deep=true: Performs explicit DB SELECT 1 and Redis PING checks.
   */
  async getHealth(req, res) {
    const isDeep = req.query.deep === 'true';

    if (!isDeep) {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        state: {
          redis: redisReady ? 'ready' : 'disconnected',
          db: dbReady ? 'ready' : 'disconnected',
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      });
    }

    try {
      const [pgStatus, redisStatus] = await Promise.all([
        prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch((e) => `error: ${e.message}`),
        redis.ping().then((p) => (p === 'PONG' ? 'connected' : 'degraded')).catch((e) => `error: ${e.message}`),
      ]);

      const ok = pgStatus === 'connected' && redisStatus === 'connected';
      return res.status(ok ? 200 : 503).json({
        status: ok ? 'healthy' : 'degraded',
        services: { postgres: pgStatus, redis: redisStatus },
        uptimeSeconds: Math.floor(process.uptime()),
      });
    } catch (err) {
      return res.status(503).json({
        status: 'degraded',
        error: err.message,
      });
    }
  },
};

export default healthController;
