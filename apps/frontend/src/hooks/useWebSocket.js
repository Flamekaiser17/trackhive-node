import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Real-time Socket Hook
 * Connects directly to the TrackHive Node.js Socket.io gateway.
 * Bridges live telemetry events into the format expected by FleetContext.
 */
const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(true);
  const [lastMessage, setLastMessage] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    const isProdHost = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
    const backendUrl =
      import.meta.env.VITE_NODE_URL ||
      import.meta.env.VITE_API_URL ||
      (isProdHost ? 'https://trackhive-api.onrender.com' : 'http://localhost:5000');

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setDataLoaded(true);
      socket.emit('join:room', 'room:admin');
      console.log('[Socket] Connected to TrackHive real-time gateway, joined room:admin');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('fleet:agent_moved', (data) => {
      setLastMessage({
        type: 'agent_location_update',
        agent_id: data.agentId,
        agent_name: `Agent_${data.agentId}`,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        battery: data.battery,
        status: 'available',
      });
    });

    socket.on('fleet:status_updated', (data) => {
      setLastMessage({
        type: 'agent_status_change',
        agent_id: data.agentId,
        status: data.status,
      });
    });

    socket.on('order:assigned', (data) => {
      setLastMessage({
        type: 'order_update',
        order_id: data.orderId,
        agent_id: data.agentId,
        status: data.status,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = useCallback((data) => {
    if (socketRef.current?.connected) {
      if (data?.type === 'TELEMETRY_PING') {
        socketRef.current.emit('agent:telemetry', data);
      } else {
        socketRef.current.emit('message', data);
      }
    }
  }, []);

  return { connected, dataLoaded, lastMessage, sendMessage };
};

export default useWebSocket;
