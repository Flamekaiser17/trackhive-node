import 'dotenv/config';
import http from 'http';
import app from './app.js';
import prisma from './config/prisma.js';
import redis from './config/redis.js';
import { setupTelemetrySocket } from './sockets/telemetryGateway.js';
import { startAnomalyWorker } from './workers/anomalyWorker.js';
import { setSocketIO } from './services/dispatchService.js';

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io telemetry gateway
const io = setupTelemetrySocket(server);

// Inject io into dispatch service so it can broadcast order:assigned events
setSocketIO(io);

// Start BullMQ background anomaly worker
let anomalyWorker;

async function startServer() {
  try {
    // 1. Verify PostgreSQL connection
    await prisma.$connect();
    console.log('[PostgreSQL] Connected via Prisma');

    // 2. Verify Redis connection
    await redis.ping();
    console.log('[Redis] Hot-state cache ready');

    // 3. Start decoupled anomaly worker
    anomalyWorker = startAnomalyWorker();
    console.log('[BullMQ] Anomaly worker initialized');

    // 4. Start HTTP & WebSocket server
    server.listen(PORT, () => {
      console.log(`[TrackHive] Engine running on port ${PORT}`);
      console.log(`[TrackHive] Dispatch Engine: POST /api/orders/:id/auto-assign`);
    });
  } catch (error) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[TrackHive] Gracefully shutting down...');
  try {
    if (anomalyWorker) await anomalyWorker.close();
    await prisma.$disconnect();
    redis.disconnect();
    server.close(() => {
      console.log('[TrackHive] HTTP and Socket server closed');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();

export { app, server, io };
