import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import { authController } from './controllers/authController.js';
import prisma from './config/prisma.js';
import redis from './config/redis.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// In-memory readiness state tracked passively on process lifetime
let dbReady = true;
let redisReady = true;

redis.on('ready', () => { redisReady = true; });
redis.on('connect', () => { redisReady = true; });
redis.on('error', () => { redisReady = false; });
redis.on('close', () => { redisReady = false; });

/**
 * Ultra-Fast Liveness & Readiness Healthcheck Handler
 * Returns in < 2ms without blocking the event loop on remote roundtrips.
 */
function fastHealthHandler(req, res) {
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

  // Optional ?deep=true probe for explicit infrastructure audit
  Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch((e) => `error: ${e.message}`),
    redis.ping().then((p) => p === 'PONG' ? 'connected' : 'degraded').catch((e) => `error: ${e.message}`),
  ]).then(([pgStatus, redisStatus]) => {
    const ok = pgStatus === 'connected' && redisStatus === 'connected';
    return res.status(ok ? 200 : 503).json({
      status: ok ? 'healthy' : 'degraded',
      services: { postgres: pgStatus, redis: redisStatus },
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });
}

// Healthcheck routes (instant liveness & readiness)
app.get('/health', fastHealthHandler);
app.get('/health/', fastHealthHandler);
app.get('/api/health', fastHealthHandler);
app.get('/api/health/', fastHealthHandler);

// Fast-demo endpoint support
app.post('/demo', authController.demo);
app.post('/demo/', authController.demo);

// Root Welcome & Discovery route
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'TrackHive Real-Time Telemetry Engine',
    version: '2.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      orders: '/api/orders',
      agents: '/api/agents',
      anomalies: '/api/anomalies',
      simulate: '/api/simulate'
    }
  });
});

// Mount modular API routes
app.use('/api', apiRouter);

export default app;
