/**
 * Concurrent Order Dispatch Race-Condition Test
 *
 * Scenario: Two orders are created simultaneously at Connaught Place (Delhi),
 * right next to Agent Rohit. Both auto-assign calls fire concurrently via
 * Promise.all(). Only ONE should get Rohit — the other must gracefully fall
 * back to the next nearest agent (Priya / Amit) or return a clean error.
 *
 * A double-assignment (both orders → same agent) would mean the lock failed.
 *
 * Run: node scripts/testConcurrentDispatch.js
 */

import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import geoService from '../src/services/geoService.js';
import { autoAssignOrder, setSocketIO } from '../src/services/dispatchService.js';

// Use a no-op io stub so we don't need a running Socket.io server
setSocketIO({
  to: () => ({ emit: () => {} }),
});

const CONNAUGHT_PLACE = { lat: 28.6315, lng: 77.2167 };
const KAROL_BAGH      = { lat: 28.6514, lng: 77.1907 };

// Known simulated agents from Phase 2 seeding
const KNOWN_AGENTS = {
  ROHIT: '6a572a90-a1e6-43b5-aa6a-2d4af662f604',
  PRIYA: 'fe1f1ebf-9f09-4054-82eb-6083f7cb7fd2',
  AMIT:  '25e9f464-62fe-422f-9604-51c254784a86',
};

// ─── ANSI Colors ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, label, msg) {
  console.log(`${color}${C.bold}[${label}]${C.reset} ${msg}`);
}

async function resetAgentsToAvailable() {
  log(C.cyan, 'Setup', 'Resetting all agents to AVAILABLE in PostgreSQL...');
  await prisma.deliveryAgent.updateMany({
    where: { id: { in: Object.values(KNOWN_AGENTS) } },
    data: { status: 'AVAILABLE' },
  });

  log(C.cyan, 'Setup', 'Re-indexing agents in Redis GEO (fleet:locations)...');
  await geoService.updateAgentLocation(KNOWN_AGENTS.ROHIT, 28.6315, 77.2167, 32, 95);
  await geoService.updateAgentLocation(KNOWN_AGENTS.PRIYA, 28.5494, 77.2001, 28, 88);
  await geoService.updateAgentLocation(KNOWN_AGENTS.AMIT,  28.5708, 77.3261, 40, 92);

  log(C.green, 'Setup', 'All 3 agents AVAILABLE and indexed ✓');
}

async function createTestOrder(label, pickup) {
  const order = await prisma.order.create({
    data: {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropLat: pickup.lat + 0.05,
      dropLng: pickup.lng + 0.05,
      status: 'CREATED',
    },
  });
  log(C.cyan, label, `Created order ${order.id} at (${pickup.lat}, ${pickup.lng})`);
  return order;
}

async function runConcurrencyTest() {
  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold} TrackHive — Phase 3: Concurrent Dispatch Race-Condition Test${C.reset}`);
  console.log(`${C.bold}${'═'.repeat(60)}${C.reset}\n`);

  await resetAgentsToAvailable();

  // Create both orders before any assignment (both CREATED state)
  log(C.cyan, 'Test', 'Creating 2 orders near Connaught Place & Karol Bagh...');
  const [order1, order2] = await Promise.all([
    createTestOrder('Order-1', CONNAUGHT_PLACE),
    createTestOrder('Order-2', KAROL_BAGH),
  ]);

  console.log(`\n${C.yellow}${C.bold}🔥 Firing both auto-assign calls CONCURRENTLY via Promise.all()...${C.reset}\n`);
  const startTime = Date.now();

  // The race: both calls hit the dispatch engine at the same time
  const [result1, result2] = await Promise.allSettled([
    autoAssignOrder(order1.id),
    autoAssignOrder(order2.id),
  ]);

  const elapsed = Date.now() - startTime;
  console.log(`\n${C.bold}${'─'.repeat(60)}${C.reset}`);
  console.log(`${C.bold} RESULTS (completed in ${elapsed}ms)${C.reset}`);
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}\n`);

  // ─── Order 1 result ──────────────────────────────────────────────────────
  if (result1.status === 'fulfilled') {
    const r = result1.value;
    log(C.green, 'Order-1 ✅', `ASSIGNED → Agent ${r.agent.id.slice(0, 8)}... (${r.agent.user?.email || 'N/A'})`);
    log(C.green, 'Order-1 ✅', `Order status: ${r.order.status} | Agent status: ${r.agent.status}`);
  } else {
    log(C.red, 'Order-1 ❌', `FAILED: ${result1.reason.message}`);
  }

  console.log();

  // ─── Order 2 result ──────────────────────────────────────────────────────
  if (result2.status === 'fulfilled') {
    const r = result2.value;
    log(C.green, 'Order-2 ✅', `ASSIGNED → Agent ${r.agent.id.slice(0, 8)}... (${r.agent.user?.email || 'N/A'})`);
    log(C.green, 'Order-2 ✅', `Order status: ${r.order.status} | Agent status: ${r.agent.status}`);
  } else {
    log(C.yellow, 'Order-2 ⚠ ', `No agents available or all busy: ${result2.reason.message}`);
  }

  // ─── Race-condition validation ────────────────────────────────────────────
  console.log(`\n${C.bold}${'─'.repeat(60)}${C.reset}`);
  console.log(`${C.bold} RACE CONDITION CHECK${C.reset}`);
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}\n`);

  if (result1.status === 'fulfilled' && result2.status === 'fulfilled') {
    const agent1 = result1.value.agent.id;
    const agent2 = result2.value.agent.id;

    if (agent1 === agent2) {
      log(C.red, '❌ FAIL', `DOUBLE ASSIGNMENT DETECTED! Both orders assigned to agent ${agent1.slice(0, 8)}...`);
      log(C.red, '❌ FAIL', 'The distributed lock FAILED — race condition occurred!');
    } else {
      log(C.green, '✅ PASS', `Different agents assigned — no race condition!`);
      log(C.green, '✅ PASS', `Order-1 → ${agent1.slice(0, 8)}...  |  Order-2 → ${agent2.slice(0, 8)}...`);
    }
  } else if (result1.status === 'fulfilled' || result2.status === 'fulfilled') {
    const winner = result1.status === 'fulfilled' ? 'Order-1' : 'Order-2';
    log(C.green, '✅ PASS', `${winner} got the agent. The other was cleanly rejected — lock worked correctly!`);
    log(C.green, '✅ PASS', 'Zero double-assignments. System behaved correctly under concurrency.');
  } else {
    log(C.red, '⚠  WARN', 'Both failed — check if agents are indexed in Redis GEO (run Phase 2 simulation first).');
  }

  // ─── Final DB state snapshot ──────────────────────────────────────────────
  console.log(`\n${C.bold}${'─'.repeat(60)}${C.reset}`);
  console.log(`${C.bold} FINAL DB STATE SNAPSHOT${C.reset}`);
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}\n`);

  const agents = await prisma.deliveryAgent.findMany({
    where: { id: { in: Object.values(KNOWN_AGENTS) } },
    include: { user: { select: { email: true } } },
  });

  for (const a of agents) {
    const statusColor = a.status === 'BUSY' ? C.yellow : C.green;
    console.log(`  ${statusColor}${a.status}${C.reset}  ${a.user.email.padEnd(35)} ${a.id.slice(0, 8)}...`);
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: [order1.id, order2.id] } },
    include: { agent: { include: { user: true } } },
  });

  console.log();
  for (const o of orders) {
    const agentLabel = o.agent ? `${o.agent.user.email}` : 'unassigned';
    const statusColor = o.status === 'ASSIGNED' ? C.green : C.yellow;
    console.log(
      `  Order ${o.id.slice(0, 8)}... → ${statusColor}${o.status}${C.reset}  Agent: ${agentLabel}`
    );
  }

  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}\n`);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
runConcurrencyTest()
  .catch((err) => {
    console.error('[Test Error]', err);
  })
  .finally(async () => {
    redis.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });

