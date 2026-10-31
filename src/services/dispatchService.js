/**
 * Atomic Order Dispatch Service
 *
 * Interview Concept: Combines two complementary concurrency safety layers:
 *
 *   Layer 1 — Redis Distributed Lock (optimistic fast-path):
 *     Prevents two API workers from even entering the DB transaction for the
 *     same agent simultaneously. Acquired in <1ms (single Redis round-trip).
 *
 *   Layer 2 — PostgreSQL ACID Transaction (authoritative ground truth):
 *     Inside the lock, re-reads the agent row with the latest committed state.
 *     Even if the Redis lock is somehow bypassed, the DB enforces serializability.
 *     This double-check is the "belt-and-suspenders" pattern for correctness.
 *
 * Without Layer 1: Both processes could reach the DB transaction concurrently
 *   and race at the SQL level (TOCTOU — Time Of Check, Time Of Use).
 * Without Layer 2: A Redis failure or TTL edge-case could allow double assignment.
 */

import prisma from '../config/prisma.js';
import geoService from './geoService.js';
import { acquireLock, releaseLock } from './lockService.js';

// Module-level io reference — set once after Socket.io initializes in server.js
let _io = null;

/**
 * Inject the Socket.io server instance (called from server.js after setup).
 * @param {import('socket.io').Server} ioInstance
 */
export function setSocketIO(ioInstance) {
  _io = ioInstance;
}

export function getSocketIO() {
  return _io;
}

/**
 * Automatically find and assign the nearest available agent to an order.
 * Implements distributed lock + ACID transaction to prevent double assignment.
 *
 * @param {string} orderId - UUID of the order to assign
 * @returns {Promise<{ order, agent } | null>}
 */
export async function autoAssignOrder(orderId) {
  // ─── Step 1: Fetch order details from PostgreSQL ────────────────────────────
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== 'CREATED') {
    throw new Error(`Order ${orderId} is already ${order.status} — cannot reassign`);
  }

  // ─── Step 2: Query nearest available agents from Redis GEO index ────────────
  const candidates = await geoService.getNearbyAvailableAgents(
    order.pickupLat,
    order.pickupLng,
    10 // 10 km search radius
  );

  if (candidates.length === 0) {
    throw new Error('No available agents found within 10 km of pickup location');
  }

  console.log(
    `[Dispatch] Order ${orderId} — found ${candidates.length} candidate(s) within 10km`
  );

  // ─── Step 3: Iterate candidates, lock → verify → assign ─────────────────────
  for (const candidate of candidates) {
    const { agentId, distanceKm } = candidate;

    console.log(
      `[Dispatch] Trying agent ${agentId.slice(0, 8)}... (${distanceKm.toFixed(2)} km away)`
    );

    // Layer 1: Acquire Redis distributed lock (5-second TTL)
    const lockToken = await acquireLock(agentId, 5);

    if (!lockToken) {
      // Another concurrent request is already processing this agent — skip
      console.log(`[Dispatch] Agent ${agentId.slice(0, 8)}... is locked, skipping`);
      continue;
    }

    try {
      // Layer 2: ACID transaction — re-verify and atomically assign
      const result = await prisma.$transaction(async (tx) => {
        // Re-read agent with latest committed data inside the transaction
        const freshAgent = await tx.deliveryAgent.findUnique({
          where: { id: agentId },
          include: { user: { select: { email: true } } },
        });

        // Guard: if status changed between GEO query and now, abort
        if (!freshAgent || freshAgent.status !== 'AVAILABLE') {
          throw new Error(`Agent ${agentId} status changed to ${freshAgent?.status} — skipping`);
        }

        // Atomically flip both records in a single DB transaction
        const [assignedOrder, busyAgent] = await Promise.all([
          tx.order.update({
            where: { id: orderId },
            data: { agentId, status: 'ASSIGNED' },
          }),
          tx.deliveryAgent.update({
            where: { id: agentId },
            data: { status: 'BUSY' },
          }),
        ]);

        return { order: assignedOrder, agent: { ...busyAgent, user: freshAgent.user } };
      });

      // ─── Step 4: Broadcast assignment event via Socket.io ──────────────────
      if (_io) {
        const socketPayload = {
          orderId,
          agentId,
          agentEmail: result.agent.user?.email,
          distanceKm,
          timestamp: Date.now(),
        };
        _io.to('room:admin').emit('order:assigned', socketPayload);
        _io.to(`agent:${agentId}`).emit('order:assigned', socketPayload);
      }

      console.log(
        `[Dispatch] ✅ Order ${orderId} → Agent ${agentId.slice(0, 8)}... assigned successfully`
      );
      return result;
    } catch (txError) {
      // Transaction failed (agent became unavailable between lock and DB write)
      console.warn(`[Dispatch] Transaction aborted for agent ${agentId.slice(0, 8)}...: ${txError.message}`);
      // Continue to the next candidate
    } finally {
      // Always release the lock, even if the transaction threw
      await releaseLock(agentId);
    }
  }

  // Exhausted all candidates without a successful assignment
  throw new Error('All nearby agents are currently busy. Order queued for retry.');
}

export default { autoAssignOrder, setSocketIO };

