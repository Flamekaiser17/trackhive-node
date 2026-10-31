import { Router } from 'express';
import prisma from '../config/prisma.js';
import geoService from '../services/geoService.js';
import { getSocketIO } from '../services/dispatchService.js';

const router = Router();
let simulationInterval = null;

router.post(['/start', '/start/'], async (req, res) => {
  try {
    const agentCount = Number(req.body.agent_count || 50);
    const io = getSocketIO();

    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }

    // Coordinates around Central Bengaluru / Connaught Place
    const baseLat = 12.9716;
    const baseLng = 77.5946;

    // Simulate agent movement telemetry
    simulationInterval = setInterval(async () => {
      const ioInstance = getSocketIO();
      if (!ioInstance) return;

      const randomAgentIndex = Math.floor(Math.random() * Math.min(agentCount, 15)) + 1;
      const agentId = `sim-agent-${randomAgentIndex}`;
      const latOffset = (Math.random() - 0.5) * 0.05;
      const lngOffset = (Math.random() - 0.5) * 0.05;
      const speed = Math.floor(25 + Math.random() * 55);
      const battery = Math.floor(60 + Math.random() * 40);

      const lat = Number((baseLat + latOffset).toFixed(6));
      const lng = Number((baseLng + lngOffset).toFixed(6));

      try {
        await geoService.updateAgentLocation(agentId, lat, lng, speed, battery);
      } catch (_) {}

      ioInstance.to('room:admin').emit('fleet:agent_moved', {
        agentId,
        lat,
        lng,
        speed,
        battery,
        timestamp: Date.now(),
      });
    }, 1500);

    return res.status(200).json({
      status: 'success',
      message: `Chaos Hub simulation active with ${agentCount} nodes`,
      agent_count: agentCount,
    });
  } catch (error) {
    console.error('[Simulate.start]', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post(['/stop', '/stop/'], (req, res) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  return res.status(200).json({
    status: 'success',
    message: 'Simulation terminated',
  });
});

export default router;
