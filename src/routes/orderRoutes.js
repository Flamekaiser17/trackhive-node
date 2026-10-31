import { Router } from 'express';
import { orderController } from '../controllers/orderController.js';

const router = Router();

// GET  /api/orders            — List all orders with agent details
router.get('/', orderController.listOrders);

// POST /api/orders            — Create a new delivery order
router.post('/', orderController.createOrder);

// POST /api/orders/:orderId/auto-assign — Atomic dispatch engine (Phase 3)
router.post('/:orderId/auto-assign', orderController.autoAssign);

// POST /api/orders/:orderId/assign      — Manual assignment with ACID tx (Phase 1)
router.post('/:orderId/assign', orderController.assignOrder);

export default router;
