import prisma from '../config/prisma.js';
import geoService from '../services/geoService.js';
import { getOrSetCache, invalidateCache } from '../services/cacheService.js';

export const agentController = {
  /**
   * GET /api/agents
   * Optimizations:
   *   - Enforce pagination limit: default 50 records.
   *   - Selective projection: only fetch essential agent & user columns.
   *   - 10-second read-through cache for admin polling.
   */
  async getAgents(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const cacheKey = `cache:agents:limit_${limit}`;

      const data = await getOrSetCache(cacheKey, 10, async () => {
        const agents = await prisma.deliveryAgent.findMany({
          take: limit,
          select: {
            id: true,
            status: true,
            currentLat: true,
            currentLng: true,
            currentSpeed: true,
            batteryLevel: true,
            isSimulated: true,
            user: {
              select: {
                email: true,
                role: true,
              },
            },
          },
        });
        return { agents };
      });

      return res.status(200).json(data);
    } catch (error) {
      console.error('[agentController.getAgents]', error);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }
  },

  async updateTelemetry(req, res) {
    try {
      const { agentId } = req.params;
      const { lat, lng, speed = 0, batteryLevel = 100, status } = req.body;

      const pLat = lat !== undefined ? parseFloat(lat) : undefined;
      const pLng = lng !== undefined ? parseFloat(lng) : undefined;
      const pSpeed = parseFloat(speed);
      const pBattery = parseInt(batteryLevel, 10);

      // 1. Hot state in Redis
      if (pLat !== undefined && pLng !== undefined) {
        geoService.updateAgentLocation(agentId, pLat, pLng, pSpeed, pBattery).catch(() => {});
      }

      // 2. Persistent agent state in PostgreSQL
      const updatedAgent = await prisma.deliveryAgent.update({
        where: { id: agentId },
        data: {
          ...(pLat !== undefined ? { currentLat: pLat } : {}),
          ...(pLng !== undefined ? { currentLng: pLng } : {}),
          currentSpeed: pSpeed,
          batteryLevel: pBattery,
          ...(status ? { status } : {}),
        },
        select: {
          id: true,
          status: true,
          currentLat: true,
          currentLng: true,
          currentSpeed: true,
          batteryLevel: true,
        },
      });

      setImmediate(() => {
        invalidateCache(['cache:agents:limit_50']);
      });

      return res.status(200).json({ agent: updatedAgent });
    } catch (error) {
      console.error('[agentController.updateTelemetry]', error);
      return res.status(500).json({ error: 'Failed to update agent telemetry' });
    }
  },

  async getNearbyAgents(req, res) {
    try {
      const { lat, lng, radius = 5 } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and Longitude query params required' });
      }

      const nearby = await geoService.getNearbyAvailableAgents(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius)
      );

      return res.status(200).json({ nearby });
    } catch (error) {
      console.error('[agentController.getNearbyAgents]', error);
      return res.status(500).json({ error: 'Failed to query nearby agents' });
    }
  },
};

export default agentController;
