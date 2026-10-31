import { Worker } from 'bullmq';
import redis from '../config/redis.js';
import prisma from '../config/prisma.js';
import { ANOMALY_QUEUE_NAME } from '../queues/anomalyQueue.js';

export function startAnomalyWorker() {
  const worker = new Worker(
    ANOMALY_QUEUE_NAME,
    async (job) => {
      const { agentId, type, anomalyType, details, speed, lat, lng } = job.data;
      const resolvedType = anomalyType || type || 'SPEED_ANOMALY';
      const resolvedDetails = details || { speed, lat, lng };

      console.log(`[Worker] Detected ${resolvedType} for agent ${agentId}:`, resolvedDetails);

      try {
        // Check if agent exists in PostgreSQL to satisfy FK constraint
        const agentExists = await prisma.deliveryAgent.findUnique({
          where: { id: agentId },
        });

        if (agentExists) {
          const anomaly = await prisma.anomalyLog.create({
            data: {
              agentId,
              anomalyType: resolvedType,
              details: typeof resolvedDetails === 'string' ? resolvedDetails : JSON.stringify(resolvedDetails),
            },
          });
          console.log(`[Worker] Anomaly logged to DB with id ${anomaly.id}`);
          return anomaly;
        } else {
          console.warn(`[Worker] Agent ${agentId} not found in DB (simulated/in-memory). Skipping DB persistence.`);
          return { agentId, anomalyType: resolvedType, status: 'simulated_logged' };
        }
      } catch (err) {
        console.error('[Worker] Error persisting anomaly:', err.message);
        throw err;
      }
    },
    { connection: redis }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err?.message);
  });

  return worker;
}

export default startAnomalyWorker;
