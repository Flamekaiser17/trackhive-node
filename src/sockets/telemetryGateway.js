import { Server } from 'socket.io';
import geoService from '../services/geoService.js';
import prisma from '../config/prisma.js';
import { anomalyQueue } from '../queues/anomalyQueue.js';

/**
 * Real-Time Telemetry Socket Gateway
 * @param {import('http').Server} httpServer
 */
export function setupTelemetrySocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Room join handling (command center or individual driver channels)
    socket.on('join:room', (roomName) => {
      socket.join(roomName);
      console.log(`[Socket.io] Socket ${socket.id} joined room: ${roomName}`);
      socket.emit('joined', { room: roomName });
    });

    // Support object payload for join
    socket.on('join', ({ room }) => {
      if (room) {
        socket.join(room);
        console.log(`[Socket.io] Socket ${socket.id} joined room: ${room}`);
        socket.emit('joined', { room });
      }
    });

    /**
     * Event: agent:telemetry
     * Payload: { agentId, lat, lng, speed, battery }
     */
    socket.on('agent:telemetry', async (data) => {
      try {
        const { agentId, lat, lng, speed = 0, battery = 100 } = data;

        if (!agentId || lat === undefined || lng === undefined) {
          return socket.emit('error', { message: 'agentId, lat, and lng are required' });
        }

        // 1. Hot state update in Upstash Redis (GEOADD + Hash with TTL)
        await geoService.updateAgentLocation(agentId, lat, lng, speed, battery);

        const telemetryPayload = {
          agentId,
          lat,
          lng,
          speed,
          battery,
          timestamp: Date.now(),
        };

        // 2. Broadcast moved event to command center admin room
        io.to('room:admin').emit('fleet:agent_moved', telemetryPayload);

        // Also broadcast to the agent's dedicated room
        io.to(`agent:${agentId}`).emit('agent:telemetry_ack', telemetryPayload);

        // 3. Speed Anomaly Trigger (> 100 km/h) -> Dispatch to BullMQ
        if (speed > 100) {
          console.warn(`[Telemetry] High speed anomaly detected for agent ${agentId}: ${speed} km/h`);
          await anomalyQueue.add('detect-anomaly', {
            agentId,
            type: 'SPEED_ANOMALY',
            speed,
            lat,
            lng,
            detectedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[Socket.io] Telemetry error:', err.message);
      }
    });

    /**
     * Event: agent:status_change
     * Payload: { agentId, status } ('AVAILABLE' | 'BUSY' | 'OFFLINE')
     */
    socket.on('agent:status_change', async (data) => {
      try {
        const { agentId, status } = data;
        const validStatuses = ['AVAILABLE', 'BUSY', 'OFFLINE'];

        if (!agentId || !validStatuses.includes(status)) {
          return socket.emit('error', { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        // If agent goes offline, remove from geospatial indexing
        if (status === 'OFFLINE') {
          await geoService.removeAgentLocation(agentId);
        }

        // Update status in PostgreSQL if agent exists
        try {
          const agent = await prisma.deliveryAgent.findUnique({ where: { id: agentId } });
          if (agent) {
            await prisma.deliveryAgent.update({
              where: { id: agentId },
              data: { status },
            });
          }
        } catch (dbErr) {
          console.warn(`[Socket.io] DB agent status update skipped: ${dbErr.message}`);
        }

        // Broadcast to command center
        const statusPayload = {
          agentId,
          status,
          timestamp: Date.now(),
        };

        io.to('room:admin').emit('fleet:status_updated', statusPayload);
        io.to(`agent:${agentId}`).emit('agent:status_ack', statusPayload);
        console.log(`[Socket.io] Agent ${agentId} status updated to: ${status}`);
      } catch (err) {
        console.error('[Socket.io] Status change error:', err.message);
      }
    });

    // Graceful disconnect handling
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export default setupTelemetrySocket;
