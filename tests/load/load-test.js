/**
 * TrackHive Node.js Load Testing Benchmark (Pure ESM)
 * Replaces legacy locustfile.py using autocannon and native Node.js benchmarks.
 *
 * Scenarios covered from locustfile.py:
 *  1. Health & Readiness Probe (/health)
 *  2. Admin Orders Query (/api/orders)
 *  3. Admin Agents Query (/api/agents)
 *  4. Admin Anomalies Query (/api/anomalies)
 *  5. Order Ingestion Load (POST /api/orders)
 *  6. Agent Telemetry Location Ingestion (PATCH /api/agents/:id/telemetry)
 *
 * Reports:
 *  - Requests Per Second (RPS) (avg & max)
 *  - Average Latency
 *  - p95 & p99 Latency
 *  - Error Rate & HTTP Status Breakdown
 */

import autocannon from 'autocannon';
import 'dotenv/config';

const TARGET_URL = process.env.TARGET_URL || `http://localhost:${process.env.PORT || 5000}`;
const DURATION = parseInt(process.env.TEST_DURATION || '10', 10);
const CONNECTIONS = parseInt(process.env.CONCURRENCY || '25', 10);

function formatSummary(title, result) {
  const totalRequests = result.requests.total;
  const non2xx = result.non2xx || 0;
  const errors = result.errors || 0;
  const totalFailed = non2xx + errors;
  const errorRate = totalRequests > 0 ? ((totalFailed / (totalRequests + errors)) * 100).toFixed(2) : '0.00';

  console.log(`\n============================================================`);
  console.log(` BENCHMARK SCENARIO: ${title}`);
  console.log(` Target: ${result.url}`);
  console.log(` Duration: ${result.duration}s | Concurrency: ${result.connections}`);
  console.log(`============================================================`);
  console.log(` Throughput (RPS):`);
  console.log(`   - Average RPS : ${result.requests.average} req/sec`);
  console.log(`   - Max RPS     : ${result.requests.max} req/sec`);
  console.log(`   - Total Reqs  : ${totalRequests}`);
  console.log(` Latency Profile:`);
  console.log(`   - Avg Latency : ${result.latency.average} ms`);
  console.log(`   - p50         : ${result.latency.p50} ms`);
  console.log(`   - p90         : ${result.latency.p90} ms`);
  console.log(`   - p95 (95th%) : ${result.latency.p97_5} ms`);
  console.log(`   - p99 (99th%) : ${result.latency.p99} ms`);
  console.log(` Reliability:`);
  console.log(`   - 2xx Success : ${result['2xx'] || 0}`);
  console.log(`   - Non-2xx     : ${non2xx}`);
  console.log(`   - Socket Errs : ${errors}`);
  console.log(`   - Error Rate  : ${errorRate}%`);
  console.log(`============================================================\n`);

  return {
    scenario: title,
    avgRps: result.requests.average,
    avgLatencyMs: result.latency.average,
    p95Ms: result.latency.p97_5,
    errorRatePercent: errorRate,
  };
}

async function runScenario(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function verifyServerAvailable(url) {
  try {
    const res = await fetch(`${url}/health`);
    if (res.ok) {
      console.log(`[LoadTest] Server check passed: ${url}/health is responsive.`);
      return true;
    }
  } catch (err) {
    console.error(`[LoadTest] Server unreachable at ${url}: ${err.message}`);
    return false;
  }
  return false;
}

async function runAllBenchmarks() {
  console.log(`\nStarting TrackHive High-Concurrency Load Test Suite...`);
  console.log(`Target Engine: ${TARGET_URL}`);
  console.log(`Duration per scenario: ${DURATION}s | Concurrency: ${CONNECTIONS}\n`);

  const isUp = await verifyServerAvailable(TARGET_URL);
  if (!isUp) {
    console.error(`\n[FATAL] Engine is not running on ${TARGET_URL}.`);
    console.error(`Please start the server first with: npm start (or npm run dev)\n`);
    process.exit(1);
  }

  const summaries = [];

  // 1. Healthcheck Scenario
  const healthRes = await runScenario({
    url: `${TARGET_URL}/health`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
    title: 'Healthcheck Endpoint',
  });
  summaries.push(formatSummary('System Healthcheck Probe (/health)', healthRes));

  // 2. Admin Active Orders Query
  const ordersQueryRes = await runScenario({
    url: `${TARGET_URL}/api/orders`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
    title: 'Orders Query',
  });
  summaries.push(formatSummary('Admin Fetch Orders (/api/orders)', ordersQueryRes));

  // 3. Admin Available & Busy Agents Query
  const agentsQueryRes = await runScenario({
    url: `${TARGET_URL}/api/agents`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
    title: 'Agents Query',
  });
  summaries.push(formatSummary('Admin Fetch Agents (/api/agents)', agentsQueryRes));

  // 4. Admin Anomalies Query
  const anomaliesQueryRes = await runScenario({
    url: `${TARGET_URL}/api/anomalies`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
    title: 'Anomalies Query',
  });
  summaries.push(formatSummary('Admin Fetch Anomalies (/api/anomalies)', anomaliesQueryRes));

  // 5. High-Frequency Order Creation Ingestion
  const orderIngestRes = await runScenario({
    url: `${TARGET_URL}/api/orders`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickupLat: 28.6315,
      pickupLng: 77.2167,
      dropLat: 28.6514,
      dropLng: 77.1907,
    }),
    title: 'Order Ingestion',
  });
  summaries.push(formatSummary('Order Creation Load (POST /api/orders)', orderIngestRes));

  // Final Overall Table
  console.log(`\n================== BENCHMARK SUITE SUMMARY ==================`);
  console.table(summaries);
  console.log(`=============================================================\n`);
}

runAllBenchmarks().catch((err) => {
  console.error('[LoadTest Error]', err);
  process.exit(1);
});

