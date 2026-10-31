import client from './client';

/**
 * TrackHive API Endpoints
 * High-fidelity, data-dense logistics orchestration methods.
 */

// --- AUTHENTICATION ---
export const loginUser = async (email, password) => {
  // Now that backend is built specifically for email, send exactly { email, password }
  const response = await client.post('/api/auth/login/', { email, password });
  const { access, refresh } = response.data;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
  return response.data;
};

export const exploreDemo = async () => {
  // Call the new idempotent fast-login endpoint
  const response = await client.post('/demo/');
  const { access, refresh } = response.data;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
  return response.data;
};

export const getProfile = async () => {
  const response = await client.get('/api/auth/profile/');
  return response.data;
};

// --- AGENTS / FLEET ---
export const getAgents = async (params = {}) => {
  const response = await client.get('/api/agents/', { params });
  const data = response.data;
  return Array.isArray(data) ? data : (data?.results || []);
};

export const getAgentDetail = async (id) => {
  const response = await client.get(`/api/agents/${id}/`);
  return response.data;
};

export const resetAgentFatigue = async (id) => {
  const response = await client.patch(`/api/agents/${id}/reset_fatigue/`);
  return response.data;
};

// --- ORDERS ---
export const getOrders = async () => {
  const response = await client.get('/api/orders/');
  const data = response.data;
  const rawOrders = Array.isArray(data) ? data : (data?.orders || data?.results || []);

  return rawOrders.map(o => ({
    ...o,
    id: o.id,
    status: (o.status || 'CREATED').toLowerCase(),
    lat: o.pickupLat || o.pickup_lat || o.lat,
    lng: o.pickupLng || o.pickup_lng || o.lng,
    pickup_lat: o.pickupLat || o.pickup_lat,
    pickup_lng: o.pickupLng || o.pickup_lng,
    drop_lat: o.dropLat || o.drop_lat,
    drop_lng: o.dropLng || o.drop_lng,
    created_at: o.createdAt || o.created_at,
    agent_name: o.agent?.user?.email?.split('@')[0] || (o.agentId ? `Agent_${String(o.agentId).slice(0, 6)}` : 'Unassigned'),
    customer: o.customer || `Client_${String(o.id).slice(-4)}`,
  }));
};

export const getOrderDetail = async (id) => {
  const response = await client.get(`/api/orders/${id}/`);
  return response.data;
};

// --- ANOMALIES ---
export const getAnomalies = async () => {
  const response = await client.get('/api/anomalies/');
  const data = response.data;
  return Array.isArray(data) ? data : (data?.results || []);
};

export const resolveAnomaly = async (id) => {
  const response = await client.patch(`/api/anomalies/${id}/resolve/`);
  return response.data;
};

// --- SIMULATOR ---
export const startSimulation = async (data) => {
  const response = await client.post('/api/simulate/start/', data);
  return response.data;
};

export const stopSimulation = async () => {
  const response = await client.post('/api/simulate/stop/');
  return response.data;
};

// --- SYSTEM HEALTH ---
export const getHealth = async () => {
  const response = await client.get('/api/health/');
  return response.data;
};
