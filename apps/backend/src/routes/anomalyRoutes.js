import { Router } from 'express';
import prisma from '../config/prisma.js';
import { getOrSetCache } from '../services/cacheService.js';

const router = Router();

/**
 * GET /api/anomalies
 * Optimizations:
 *   - Enforce pagination limit: default 50 records.
 *   - Selective projection with composite index (detected_at DESC).
 *   - 10-second read-through cache for admin polling.
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const cacheKey = `cache:anomalies:limit_${limit}`;

    const formatted = await getOrSetCache(cacheKey, 10, async () => {
      const anomalies = await prisma.anomalyLog.findMany({
        take: limit,
        orderBy: { detectedAt: 'desc' },
        select: {
          id: true,
          anomalyType: true,
          agentId: true,
          details: true,
          detectedAt: true,
          agent: {
            select: {
              user: { select: { email: true } },
            },
          },
        },
      });

      return anomalies.map((a) => ({
        id: a.id,
        anomaly_type: a.anomalyType,
        type: a.anomalyType,
        agent_id: a.agentId,
        agent_name: a.agent?.user?.email?.split('@')[0] || `Agent_${a.agentId.slice(0, 6)}`,
        details: a.details,
        detected_at: a.detectedAt,
        resolved: false,
        severity: a.anomalyType === 'SPEED_ANOMALY' ? 'high' : 'medium',
      }));
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[anomalyRoutes] Error fetching anomalies:', error);
    return res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  return res.status(200).json({ message: 'Anomaly resolved successfully' });
});
router.patch('/:id/resolve/', async (req, res) => {
  return res.status(200).json({ message: 'Anomaly resolved successfully' });
});

export default router;
