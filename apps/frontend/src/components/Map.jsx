import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';
import { CITY_CENTER } from '../config';

/**
 * Titan Map — High-fidelity markers with CSS glow rings
 */
const createAgentIcon = (status, hasAnomaly, isFocused) => {
  let color = '#8B8BA7'; 
  if (hasAnomaly) color = '#FF4757';
  else if (status === 'available') color = '#00D4AA';
  else if (status === 'busy') color = '#6C63FF';
  else if (status === 'idle') color = '#FFA502';

  return L.divIcon({
    className: 'agent-marker-titan',
    html: `
      <div style="position: relative; width: 14px; height: 14px; display: flex; alignItems: center; justifyContent: center;">
        <div class="marker-glow ${isFocused ? 'agent-pulse' : ''}" style="--marker-color: ${color}60; background: ${color}20; border: 1.5px solid ${color}40;"></div>
        <div style="
          width: 12px; height: 12px; 
          background: ${color}; 
          border-radius: 50%; 
          border: 2px solid #fff;
          box-shadow: 0 0 12px ${color}80;
          position: relative;
          z-index: 2;
        "></div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const orderIcon = L.divIcon({
  className: 'order-marker-titan',
  html: `<div style="width: 10px; height: 10px; background: #6C63FF; transform: rotate(45deg); border: 2.5px solid white; box-shadow: 0 0 15px rgba(108,99,255,0.6);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const MapResizer = () => {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
};

const CenterChanger = ({ center }) => {
  const map = useMap();
  useEffect(() => { 
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true, duration: 1 }); 
    }
  }, [center, map]);
  return null;
};

const Map = ({ agents = [], orders = [], unresolvedAnomalies = [], onAgentClick, focusedAgentId }) => {
  let center = [CITY_CENTER.lat, CITY_CENTER.lng];
  if (focusedAgentId) {
    const focused = (agents || []).find(a => a.id === focusedAgentId);
    if (focused && !isNaN(focused.lat) && !isNaN(focused.lng)) {
      center = [focused.lat, focused.lng];
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ width: '100%', height: '100%', background: '#0A0A0F' }}
        zoomControl={false}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapResizer />
        <CenterChanger center={center} />

        {(agents || []).filter(a => a.lat && a.lng).map((agent) => {
          const hasAnomaly = (unresolvedAnomalies || []).some(anom => String(anom.agent_id) === String(agent.id));
          return (
            <Marker 
              key={`agent-${agent.id}`} 
              position={[agent.lat, agent.lng]} 
              icon={createAgentIcon(agent.status, hasAnomaly, String(agent.id) === String(focusedAgentId))}
              eventHandlers={{ click: () => onAgentClick && onAgentClick(agent) }}
            />
          );
        })}

        {(orders || []).filter(o => o.lat && o.lng).map((order) => (
           <Marker key={`order-${order.id}`} position={[order.lat, order.lng]} icon={orderIcon} />
        ))}
      </MapContainer>
    </div>
  );
};

export default Map;
