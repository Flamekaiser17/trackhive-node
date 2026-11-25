import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

// GET /health and /health/
router.get('/', healthController.getHealth);

export default router;
