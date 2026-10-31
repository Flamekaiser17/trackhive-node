import { io } from 'socket.io-client';
import prisma from '../src/config/prisma.js';

const SERVER_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const IS_CHAOS_ENABLED = process.argv.includes('--chaos') || true;
const MAX_TICKS = parseInt(process.env.TICKS || '6', 10);

// Base coordinates centered around Delhi NCR
const INITIAL_AGENTS = [
  {
    name: 'Agent Rohit (Connaught Place)',
    email: 'rohit.delhi@trackhive.io',
    lat: 28.6315,
    lng: 77.2167,
    speed: 32.5,
    battery: 95,
  },
  {
    name: 'Agent Priya (South Delhi)',
    email: 'priya.delhi@trackhive.io',
    lat: 28.5494,
    lng: 77.2001,
    speed: 28.0,
    battery: 88,
  },
  {
    name: 'Agent Amit (Noida Sector 18)',
    email: 'amit.noida@trackhive.io',
    lat: 28.5708,
    lng: 77.3261,
    speed: 40.0,
    battery: 92,
  },
];

async function ensureAgentsInDb() {
  console.log('[Setup] Ensuring 3 test agents exist in Supabase PostgreSQL...');
  const seededAgents = [];

  for (const item of INITIAL_AGENTS) {
    let user = await prisma.user.findUnique({
      where: { email: item.email },
      include: { deliveryAgent: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: item.email,
          password: 'password123',
          role: 'AGENT',
          deliveryAgent: {
            create: {
              currentLat: item.lat,
              currentLng: item.lng,
              currentSpeed: item.speed,
              batteryLevel: item.battery,
              status: 'AVAILABLE',
              isSimulated: true,
            },
          },
        },
        include: { deliveryAgent: true },
      });
      console.log(`[Setup] Created agent: ${item.email} (ID: ${user.deliveryAgent.id})`);
    } else if (!user.deliveryAgent) {
      const agent = await prisma.deliveryAgent.create({
        data: {
          userId: user.id,
          currentLat: item.lat,
          currentLng: item.lng,
          currentSpeed: item.speed,
          batteryLevel: item.battery,
          status: 'AVAILABLE',
          isSimulated: true,
        },
      });
      user.deliveryAgent = agent;
    }

    seededAgents.push({
      ...item,
      agentId: user.deliveryAgent.id,
    });
  }

  return seededAgents;
}

async function runSimulation() {
  let agents = [];
  try {
    agents = await ensureAgentsInDb();
  } catch (err) {
    console.warn('[Setup] Note: DB seeding skipped (using fallback IDs):', err.message);
    agents = INITIAL_AGENTS.map((a, i) => ({
      ...a,
      agentId: `00000000-0000-0000-0000-00000000000${i + 1}`,
    }));
  }

  console.log(`\nConnecting to TrackHive Telemetry Gateway at ${SERVER_URL}...`);

  // 1. Command Center Admin Socket
  const adminSocket = io(SERVER_URL, { reconnection: false, timeout: 5000 });

  adminSocket.on('connect', () => {
    console.log('[Admin Dashboard] Connected to gateway. Joining room:admin...');
    adminSocket.emit('join:room', 'room:admin');
  });

  adminSocket.on('fleet:agent_moved', (data) => {
    console.log(
      `[Admin Feed] Agent ${data.agentId.slice(0, 8)}... moved -> Lat: ${data.lat.toFixed(4)}, Lng: ${data.lng.toFixed(4)}, Speed: ${data.speed} km/h, Bat: ${data.battery}%`
    );
  });

  adminSocket.on('fleet:status_updated', (data) => {
    console.log(`[Admin Feed] Status update: Agent ${data.agentId.slice(0, 8)}... is now ${data.status}`);
  });

  // 2. Individual Agent Sockets
  const agentSockets = agents.map((agent) => {
    const socket = io(SERVER_URL, { reconnection: false, timeout: 5000 });
    socket.on('connect', () => {
      console.log(`[Driver Device] Agent ${agent.name} connected. Setting status AVAILABLE...`);
      socket.emit('agent:status_change', {
        agentId: agent.agentId,
        status: 'AVAILABLE',
      });
    });
    return { ...agent, socket };
  });

  let tickCount = 0;

  const intervalId = setInterval(async () => {
    tickCount++;
    console.log(`\n--- [Telemetry Tick #${tickCount}/${MAX_TICKS}] ---`);

    for (let i = 0; i < agentSockets.length; i++) {
      const agent = agentSockets[i];

      // Simulate realistic GPS drift (~20-50 meters)
      agent.lat += (Math.random() - 0.48) * 0.001;
      agent.lng += (Math.random() - 0.48) * 0.001;
      agent.battery = Math.max(10, agent.battery - 1);

      let currentSpeed = Math.floor(25 + Math.random() * 20);

      // CHAOS TRIGGER: Tick #3 triggers a high-speed anomaly (> 110 km/h) on Agent 1
      if (IS_CHAOS_ENABLED && tickCount === 3 && i === 0) {
        currentSpeed = 126.4; // Exceeds 100 km/h threshold!
        console.log(`\n🚨 [CHAOS INJECTION] Triggering SPEED_ANOMALY on ${agent.name}: ${currentSpeed} km/h!\n`);
      }

      agent.socket.emit('agent:telemetry', {
        agentId: agent.agentId,
        lat: agent.lat,
        lng: agent.lng,
        speed: currentSpeed,
        battery: agent.battery,
      });
    }

    if (tickCount >= MAX_TICKS) {
      clearInterval(intervalId);
      console.log(`\nSimulation completed (${MAX_TICKS} ticks). Disconnecting clients...`);

      setTimeout(async () => {
        adminSocket.disconnect();
        agentSockets.forEach((a) => a.socket.disconnect());
        await prisma.$disconnect();
        console.log('[Simulation] Done.');
        process.exit(0);
      }, 1500);
    }
  }, 2000);
}

runSimulation().catch(async (e) => {
  console.error('[Simulation Error]', e);
  await prisma.$disconnect();
  process.exit(1);
});

