import { Queue } from 'bullmq';
import redis from '../config/redis.js';

export const ANOMALY_QUEUE_NAME = 'agent-anomalies';

export const anomalyQueue = new Queue(ANOMALY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function addAnomalyJob(agentId, anomalyType, details) {
  return await anomalyQueue.add('detect-anomaly', {
    agentId,
    anomalyType,
    details,
    detectedAt: new Date().toISOString(),
  });
}

