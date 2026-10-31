/**
 * FleetMap.jsx
 * CartoDB Dark Matter map with live SVG vehicle markers, animated on
 * fleet:agent_moved events. Renders pickup/drop pins with dashed polylines
 * for ASSIGNED orders.
 */
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── SVG Vehicle Icon Factory ────────────────────────────────────────────────

function makeVehicleIcon(status, speed = 0) {
  const isAnomaly = speed > 100;
  const isAvailable = status === 'AVAILABLE';
  const isBusy = status === 'BUSY';

  let fill, glow, pulseClass;
  if (isAnomaly)       { fill = '#f43f5e'; glow = '#f43f5e60'; pulseClass = 'fleet-pulse-red'; }
  else if (isAvailable){ fill = '#10b981'; glow = '#10b98160'; pulseClass = 'fleet-pulse-green'; }
  else if (isBusy)     { fill = '#f59e0b'; glow = '#f59e0b50'; pulseClass = ''; }
  else                 { fill = '#6b7280'; glow = '#6b728030'; pulseClass = ''; }

  const svg = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      ${pulseClass ? `
        <div class="${pulseClass}" style="
          position:absolute;inset:-6px;border-radius:50%;
          border:2px solid ${fill};opacity:0.5;animation:fleetPulse 2s ease-in-out infinite;
        "></div>` : ''}
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="${fill}" style="filter:drop-shadow(0 0 6px ${glow});z-index:2;">
        <circle cx="12" cy="12" r="6" fill="${fill}"/>
        <circle cx="12" cy="12" r="4" fill="#0f0f0f" opacity="0.4"/>
        <circle cx="12" cy="12" r="2.5" fill="${fill}"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'fleet-vehicle-marker',
    html: svg,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;background:#10b981;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 10px #10b98170;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const dropIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;background:#6366f1;border:2.5px solid #fff;transform:rotate(45deg);box-shadow:0 0 10px #6366f170;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── Smooth Pan to Delhi if no agents yet ──────────────────────────────────────
const InitialView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true, duration: 1 });
  }, [center, map]);
  return null;
};

// ── Component ────────────────────────────────────────────────────────────────
const FleetMap = ({ agentPositions = {}, agents = [], orders = [] }) => {
  const mapRef = useRef(null);

  // Merge Socket.io live positions over static agent list
  const mergedAgents = agents.map((a) => {
    const live = agentPositions[a.id];
    return live ? { ...a, lat: live.lat, lng: live.lng, speed: live.speed, battery: live.battery } : a;
  });

  // Also show any live agents not yet in agents list (seeded via simulation)
  const liveOnlyIds = Object.keys(agentPositions).filter(
    (id) => !agents.some((a) => a.id === id)
  );
  const liveOnly = liveOnlyIds.map((id) => ({
    id,
    ...agentPositions[id],
    status: 'AVAILABLE',
    email: id.slice(0, 8) + '...',
  }));

  const allAgents = [...mergedAgents, ...liveOnly];

  const activeOrders = orders.filter(
    (o) => (o.status === 'ASSIGNED' || o.status === 'IN_TRANSIT') && o.pickupLat
  );

  const center = allAgents[0]?.lat
    ? [allAgents[0].lat, allAgents[0].lng]
    : [28.6315, 77.2167]; // Connaught Place default

  return (
    <>
      <style>{`
        @keyframes fleetPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        .fleet-vehicle-marker { background: transparent !important; border: none !important; }
        .leaflet-container { background: #0a0a0f; }
      `}</style>
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: '100%', height: '100%', background: '#0a0a0f' }}
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
/>
        <InitialView center={center} />

        {/* Vehicle Markers */}
        {allAgents.filter((a) => a.lat && a.lng).map((agent) => (
          <Marker
            key={`fleet-${agent.id}`}
            position={[agent.lat, agent.lng]}
            icon={makeVehicleIcon(agent.status, agent.speed)}
          >
            <Popup>
              <div style={{ background: '#18181b', color: '#fff', padding: 8, borderRadius: 8, fontSize: 12, minWidth: 160 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{agent.email || agent.id?.slice(0, 8)}</p>
                <p style={{ color: '#10b981' }}>Speed: {Math.round(agent.speed || 0)} km/h</p>
                <p style={{ color: '#f59e0b' }}>Battery: {agent.battery || 100}%</p>
                <p style={{ color: '#94a3b8', fontSize: 10 }}>{agent.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Order Pickup → Drop Polylines */}
        {activeOrders.map((order) => {
          const pickup = [order.pickupLat, order.pickupLng];
          const drop = [order.dropLat, order.dropLng];
          return (
            <span key={`order-lines-${order.id}`}>
              <Marker position={pickup} icon={pickupIcon}>
                <Popup><div style={{ fontSize: 11 }}>📦 Pickup — Order {order.id?.slice(0, 8)}</div></Popup>
              </Marker>
              <Marker position={drop} icon={dropIcon}>
                <Popup><div style={{ fontSize: 11 }}>📍 Drop — Order {order.id?.slice(0, 8)}</div></Popup>
              </Marker>
              <Polyline
                positions={[pickup, drop]}
                pathOptions={{ color: '#6366f1', weight: 1.5, dashArray: '6 4', opacity: 0.7 }}
              />
            </span>
          );
        })}
      </MapContainer>
    </>
  );
};

export default FleetMap;

