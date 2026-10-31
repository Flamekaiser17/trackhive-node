import { Router } from 'express';
import { agentController } from '../controllers/agentController.js';

const router = Router();

router.get('/', agentController.getAgents);
router.get('/nearby', agentController.getNearbyAgents);
router.patch('/:agentId/telemetry', agentController.updateTelemetry);

export default router;

