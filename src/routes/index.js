import { Router } from 'express';
import authRoutes from './authRoutes.js';
import agentRoutes from './agentRoutes.js';
import orderRoutes from './orderRoutes.js';
import anomalyRoutes from './anomalyRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/agents', agentRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/anomalies', anomalyRoutes);

export default apiRouter;
