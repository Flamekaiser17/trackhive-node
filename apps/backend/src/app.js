import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import healthRoutes from './routes/healthRoutes.js';
import { authController } from './controllers/authController.js';
import errorHandler from './middlewares/error.middleware.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Root-level healthcheck routes (/health and /health/)
app.use('/health', healthRoutes);

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

// Global Error Handler Middleware (MUST be mounted after all routes)
app.use(errorHandler);

export default app;
