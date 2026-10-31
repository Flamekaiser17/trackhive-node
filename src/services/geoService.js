import redis from '../config/redis.js';
import prisma from '../config/prisma.js';

export const LOCATIONS_KEY = 'fleet:locations';
export const AGENT_STATE_PREFIX = 'agent:state:';
export const STATE_TTL_SECONDS = 3600; // 1-hour TTL for hot telemetry

export const geoService = {
  /**
   * Update agent location in Redis Geospatial index and store hot state metadata in Redis Hash
   * @param {string} agentId - UUID of delivery agent
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} [speed=0] - Speed in km/h
   * @param {number} [battery=100] - Battery percentage
   */
  async updateAgentLocation(agentId, lat, lng, speed = 0, battery = 100) {
    if (!agentId || lat === undefined || lng === undefined) {
      throw new Error('agentId, lat, and lng are required');
    }

    const stateKey = `${AGENT_STATE_PREFIX}${agentId}`;
    const timestamp = Date.now().toString();

    // Use pipeline to atomically update GEO index and Hash with TTL
    const pipeline = redis.pipeline();

    // Redis GEO commands expect longitude first, then latitude
    pipeline.geoadd(LOCATIONS_KEY, lng, lat, agentId);

    // Store metadata in Redis Hash
    pipeline.hset(stateKey, {
      agentId,
      lat: String(lat),
      lng: String(lng),
      speed: String(speed),
      battery: String(battery),
      lastSeen: timestamp,
    });

    // Set 1-hour expiration on hot state
    pipeline.expire(stateKey, STATE_TTL_SECONDS);

    const results = await pipeline.exec();
    return results;
  },

  /**
   * Find nearby available agents within radius (km) and filter out non-AVAILABLE agents
   * @param {number} lat - Target latitude
   * @param {number} lng - Target longitude
   * @param {number} [radiusKm=5] - Search radius in kilometers
   * @returns {Promise<Array>} List of nearby available agents with distance and coordinates
   */
  async getNearbyAvailableAgents(lat, lng, radiusKm = 5) {
    let rawResults = [];

    try {
      // Redis 6.2+ GEOSEARCH: FROMLONLAT <lng> <lat> BYRADIUS <radiusKm> km WITHDIST WITHCOORD ASC
      rawResults = await redis.geosearch(
        LOCATIONS_KEY,
        'FROMLONLAT',
        lng,
        lat,
        'BYRADIUS',
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC'
      );
    } catch {
      // Fallback for older Redis versions
      rawResults = await redis.georadius(
        LOCATIONS_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC'
      );
    }

    if (!rawResults || rawResults.length === 0) {
      return [];
    }

    // rawResults shape: [[agentId, distance, [lng, lat]], ...]
    const candidateAgentIds = rawResults.map((item) => item[0]);

    // Check availability: fetch agents from PostgreSQL to confirm current AgentStatus
    const availableAgentsFromDb = await prisma.deliveryAgent.findMany({
      where: {
        id: { in: candidateAgentIds },
        status: 'AVAILABLE',
      },
      select: {
        id: true,
        status: true,
        currentSpeed: true,
        batteryLevel: true,
        user: { select: { email: true } },
      },
    });

    const availableAgentMap = new Map(availableAgentsFromDb.map((a) => [a.id, a]));

    const nearbyAvailable = [];

    for (const [agentId, distanceStr, [resLng, resLat]] of rawResults) {
      const dbAgent = availableAgentMap.get(agentId);

      // Verify status is AVAILABLE
      if (dbAgent) {
        // Also fetch hot state from Redis Hash if present
        const stateKey = `${AGENT_STATE_PREFIX}${agentId}`;
        const hotState = await redis.hgetall(stateKey);

        nearbyAvailable.push({
          agentId,
          distanceKm: parseFloat(distanceStr),
          coordinates: {
            lat: parseFloat(resLat),
            lng: parseFloat(resLng),
          },
          status: dbAgent.status,
          speed: hotState.speed ? parseFloat(hotState.speed) : dbAgent.currentSpeed,
          battery: hotState.battery ? parseInt(hotState.battery, 10) : dbAgent.batteryLevel,
          lastSeen: hotState.lastSeen || null,
          user: dbAgent.user,
        });
      }
    }

    return nearbyAvailable;
  },

  /**
   * Remove agent from geospatial index when going OFFLINE
   * @param {string} agentId
   */
  async removeAgentLocation(agentId) {
    const pipeline = redis.pipeline();
    pipeline.zrem(LOCATIONS_KEY, agentId);
    pipeline.hset(`${AGENT_STATE_PREFIX}${agentId}`, 'status', 'OFFLINE');
    return await pipeline.exec();
  },

  /**
   * Get hot state of a specific agent from Redis Hash
   * @param {string} agentId
   */
  async getAgentState(agentId) {
    return await redis.hgetall(`${AGENT_STATE_PREFIX}${agentId}`);
  },
};

export default geoService;
