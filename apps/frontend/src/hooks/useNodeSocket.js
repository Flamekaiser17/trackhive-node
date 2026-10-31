/**
 * useNodeSocket.js
 * Socket.io-client hook connecting to the Node.js backend (port 5000).
 * Completely independent of the existing useWebSocket.js (Django layer).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const NODE_BACKEND = import.meta.env.VITE_NODE_URL || 'http://localhost:5000';

export function useNodeSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentPositions, setAgentPositions] = useState({}); // { agentId: { lat, lng, speed, battery, timestamp } }
  const [statusEvents, setStatusEvents] = useState([]);      // fleet:status_updated
  const [assignEvents, setAssignEvents] = useState([]);      // order:assigned
  const [anomalyEvents, setAnomalyEvents] = useState([]);    // speed anomaly logs
  const [latencyMs, setLatencyMs] = useState(null);

  useEffect(() => {
    const socket = io(NODE_BACKEND, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Join the admin command center room
      socket.emit('join:room', 'room:admin');
      console.log('[NodeSocket] Connected to TrackHive engine, joined room:admin');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Live GPS telemetry feed from all delivery agents
    socket.on('fleet:agent_moved', (data) => {
      const arrivalTs = Date.now();
      if (data.timestamp) setLatencyMs(arrivalTs - data.timestamp);

      setAgentPositions((prev) => ({
        ...prev,
        [data.agentId]: {
          lat: data.lat,
          lng: data.lng,
          speed: data.speed,
          battery: data.battery,
          timestamp: data.timestamp || arrivalTs,
        },
      }));

      // Flag speed anomaly locally for immediate UI response
      if (data.speed > 100) {
        const anomaly = {
          id: `${data.agentId}-${arrivalTs}`,
          agentId: data.agentId,
          type: 'SPEED_ANOMALY',
          speed: data.speed,
          lat: data.lat,
          lng: data.lng,
          detectedAt: new Date(arrivalTs).toISOString(),
          acknowledged: false,
        };
        setAnomalyEvents((prev) => [anomaly, ...prev].slice(0, 50));
      }
    });

    socket.on('fleet:status_updated', (data) => {
      setStatusEvents((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 30));
    });

    socket.on('order:assigned', (data) => {
      setAssignEvents((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, 30));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return {
    connected,
    agentPositions,
    statusEvents,
    assignEvents,
    anomalyEvents,
    setAnomalyEvents,
    latencyMs,
    emit,
  };
}

export default useNodeSocket;

