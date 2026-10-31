import prisma from '../config/prisma.js';
import { autoAssignOrder } from '../services/dispatchService.js';
import { getOrSetCache, invalidateCache } from '../services/cacheService.js';

export const orderController = {
  /**
   * POST /api/orders
   * Create a new delivery order with pickup & drop coordinates.
   * Optimizations:
   *   - Direct selective field insertion.
   *   - Asynchronously invalidates orders read-cache without blocking HTTP response.
   */
  async createOrder(req, res) {
    try {
      const { pickupLat, pickupLng, dropLat, dropLng } = req.body;

      if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
        return res.status(400).json({ error: 'Coordinates required: pickupLat, pickupLng, dropLat, dropLng' });
      }

      const pLat = parseFloat(pickupLat);
      const pLng = parseFloat(pickupLng);
      const dLat = parseFloat(dropLat);
      const dLng = parseFloat(dropLng);

      const order = await prisma.order.create({
        data: {
          pickupLat: pLat,
          pickupLng: pLng,
          dropLat: dLat,
          dropLng: dLng,
          status: 'CREATED',
        },
        select: {
          id: true,
          status: true,
          pickupLat: true,
          pickupLng: true,
          dropLat: true,
          dropLng: true,
          createdAt: true,
        },
      });

      // Non-blocking side effect: Invalidate orders cache
      setImmediate(() => {
        invalidateCache(['cache:orders:recent', 'cache:orders:all']);
      });

      return res.status(201).json({ order });
    } catch (error) {
      console.error('[orderController.createOrder]', error);
      return res.status(500).json({ error: 'Failed to create order' });
    }
  },

  /**
   * POST /api/orders/:orderId/auto-assign
   */
  async autoAssign(req, res) {
    const { orderId } = req.params;

    try {
      const result = await autoAssignOrder(orderId);

      // Invalidate cache in background
      setImmediate(() => {
        invalidateCache(['cache:orders:recent', 'cache:agents:all']);
      });

      return res.status(200).json({
        message: 'Order successfully assigned',
        orderId: result.order.id,
        assignedAgentId: result.agent.id,
        agentEmail: result.agent.user?.email,
        orderStatus: result.order.status,
        agentStatus: result.agent.status,
      });
    } catch (error) {
      console.error('[orderController.autoAssign]', error.message);
      const isNoAgent = error.message.includes('No available agents') ||
                        error.message.includes('All nearby agents');

      return res.status(isNoAgent ? 503 : 400).json({ error: error.message });
    }
  },

  /**
   * POST /api/orders/:orderId/assign
   */
  async assignOrder(req, res) {
    const { orderId } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const agent = await tx.deliveryAgent.findUnique({
          where: { id: agentId },
          select: { id: true, status: true },
        });

        if (!agent || agent.status !== 'AVAILABLE') {
          throw new Error(`Agent ${agentId} is not AVAILABLE`);
        }

        const [updatedOrder, updatedAgent] = await Promise.all([
          tx.order.update({
            where: { id: orderId },
            data: { agentId, status: 'ASSIGNED' },
            select: { id: true, status: true, agentId: true },
          }),
          tx.deliveryAgent.update({
            where: { id: agentId },
            data: { status: 'BUSY' },
            select: { id: true, status: true },
          }),
        ]);

        return { order: updatedOrder, agent: updatedAgent };
      });

      setImmediate(() => {
        invalidateCache(['cache:orders:recent', 'cache:agents:all']);
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[orderController.assignOrder]', error.message);
      return res.status(400).json({ error: error.message });
    }
  },

  /**
   * GET /api/orders
   * Optimizations:
   *   - Enforce pagination limit: default 50 records.
   *   - Selective column projection (no heavy unindexed joins).
   *   - Short-TTL Read-Through Cache (10 seconds) for high-frequency admin polling.
   */
  async listOrders(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const cacheKey = `cache:orders:limit_${limit}`;

      const data = await getOrSetCache(cacheKey, 10, async () => {
        const orders = await prisma.order.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            pickupLat: true,
            pickupLng: true,
            dropLat: true,
            dropLng: true,
            createdAt: true,
            agentId: true,
            agent: {
              select: {
                id: true,
                status: true,
                user: { select: { email: true } },
              },
            },
          },
        });
        return { count: orders.length, orders };
      });

      return res.status(200).json(data);
    } catch (error) {
      console.error('[orderController.listOrders]', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  },
};

export default orderController;
