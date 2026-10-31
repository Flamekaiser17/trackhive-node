import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAgents, getOrders, getAnomalies } from '../api/endpoints';
import useWebSocket from '../hooks/useWebSocket';

export const FleetContext = createContext();

export const FleetProvider = ({ children }) => {
  const [agents, setAgents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // wsReady: true by default so UI loads instantly with Node.js engine
  const [wsReady, setWsReady] = useState(true);
  const wsReadyTimerRef = useRef(null);
  
  // Simulation State Persistence
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStats, setSimStats] = useState({ agents: 0, events: 0, anomalies: 0 });
  const [simLogs, setSimLogs] = useState([
    { id: 1, time: '12:45:01', msg: 'Simulator initialized. Awaiting user commands...', type: 'system' }
  ]);

  const { connected, dataLoaded, lastMessage, sendMessage } = useWebSocket();

  // Mark wsReady when WS connects AND INITIAL_DATA is loaded. Also set a 6s max-wait fallback
  // so the UI doesn't block forever on an unresponsive WS.
  useEffect(() => {
    if (connected && dataLoaded && !wsReady) {
      setWsReady(true);
      if (wsReadyTimerRef.current) clearTimeout(wsReadyTimerRef.current);
    }
  }, [connected, dataLoaded, wsReady]);

  useEffect(() => {
    // Fallback: if WS never connects within 6s, unblock the UI anyway
    wsReadyTimerRef.current = setTimeout(() => {
      setWsReady(prev => { if (!prev) console.warn('WS_READY_FALLBACK: Unblocking UI after timeout.'); return true; });
    }, 6000);
    return () => clearTimeout(wsReadyTimerRef.current);
  }, []);

  // Unified Fetcher Logic (Production-Grade)
  const fetchData = useCallback(async () => {
    try {
      const [aData, oData, anData] = await Promise.all([
        getAgents(),
        getOrders(),
        getAnomalies()
      ]);

      // Normalize Agent Data (Always use lat/lng internally)
      const normalizedAgents = (Array.isArray(aData) ? aData : (aData.results || [])).map(a => ({
        ...a,
        lat: a.current_lat || a.lat,
        lng: a.current_lng || a.lng,
        speed: a.current_speed || a.speed || 0,
        battery_level: a.battery_level || 100,
        km_today: a.total_km_today || 0,
        orders_today: a.orders_last_4hrs || 0,
        username: a.username || a.user?.username || `Agent_${a.id}`
      }));

      setAgents(normalizedAgents);
      setOrders(Array.isArray(oData) ? oData : (oData.results || []));
      setAnomalies(Array.isArray(anData) ? anData : (anData.results || []));
      setError(null);
    } catch (err) {
      console.error('FLEET_SYNC_ERROR: Global fetch failed.', err);
      setError('Telemetry sync interrupted.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addSimLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setSimLogs(prev => [...prev.slice(-100), { id: Date.now(), time, msg, type }]);
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 30s for background sync (WS handles real-time updates)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time Pulse Processor (WebSocket)
  useEffect(() => {
    if (!lastMessage) return;

    // 0. Handle INITIAL_DATA snapshot
    if (lastMessage.type === 'INITIAL_DATA') {
       const payload = lastMessage.payload || {};
       if (payload.agents) setAgents(payload.agents);
       if (payload.orders) setOrders(payload.orders);
       if (payload.anomalies) setAnomalies(payload.anomalies);
       setLoading(false);
       return;
    }

    // 1. Handle Agent Location/Telemetry Updates (upsert — works for both real and sim agents)
    if (
      lastMessage.type === 'agent_location_update' ||
      lastMessage.type === 'tracking_message' ||
      lastMessage.type === 'agent_status_change'
    ) {
      const agentId = String(lastMessage.agent_id);

      if (lastMessage.speed !== undefined) {
        console.log(`WS_UPDATE: Agent_${agentId} @ ${lastMessage.speed} km/h, km_today=${lastMessage.km_today}`);
      }

      if (isSimulating) {
        setSimStats(prev => ({ ...prev, events: prev.events + 1 }));
      }

      setAgents(prev => {
        const exists = prev.some(a => String(a.id) === agentId);

        // UPSERT: merge if exists, otherwise insert new sim-agent row
        if (exists) {
          return prev.map(a => {
            if (String(a.id) !== agentId) return a;
            return {
              ...a,
              speed:         lastMessage.speed         !== undefined ? Number(lastMessage.speed)         : (a.speed || 0),
              lat:           lastMessage.lat           !== undefined ? lastMessage.lat                   : a.lat,
              lng:           lastMessage.lng           !== undefined ? lastMessage.lng                   : a.lng,
              fatigue_score: lastMessage.fatigue_score !== undefined ? Number(lastMessage.fatigue_score) : (a.fatigue_score || 0),
              status:        lastMessage.status        ||  a.status,
              km_today:      lastMessage.km_today      !== undefined ? Number(lastMessage.km_today)      : (a.km_today || 0),
              battery_level: lastMessage.battery       !== undefined ? Number(lastMessage.battery)       : (a.battery_level || 100),
              orders_today:  lastMessage.orders_today  !== undefined ? Number(lastMessage.orders_today)  : (a.orders_today || 0),
              username:      lastMessage.agent_name    || a.username,
            };
          });
        }

        // New agent seen over WS (sim agent not yet in initial fetch)
        const newAgent = {
          id:            lastMessage.agent_id,
          username:      lastMessage.agent_name || `Agent_${lastMessage.agent_id}`,
          lat:           lastMessage.lat || 0,
          lng:           lastMessage.lng || 0,
          speed:         Number(lastMessage.speed || 0),
          km_today:      Number(lastMessage.km_today || 0),
          fatigue_score: Number(lastMessage.fatigue_score || 0),
          status:        lastMessage.status || 'available',
          battery_level: Number(lastMessage.battery || 100),
          orders_today:  Number(lastMessage.orders_today || 0),
          is_simulated:  true,
          is_permanent:  false,
        };
        return [...prev, newAgent];
      });

      // Also log to sim activity stream
      if (isSimulating) {
        const name   = lastMessage.agent_name || `Agent_${lastMessage.agent_id}`;
        const speed  = Math.round(lastMessage.speed || 0);
        const km     = (lastMessage.km_today || 0).toFixed(1);
        addSimLog(`${name} moving @ ${speed} km/h · ${km} km today`, 'info');
      }
    }

    // 2. Handle Anomaly Events
    if (lastMessage.type === 'anomaly_detected') {
      if (isSimulating) {
        setSimStats(prev => ({ ...prev, anomalies: prev.anomalies + 1 }));
        addSimLog(`ANOMALY DETECTED: ${lastMessage.anomaly_type} on Agent_${lastMessage.agent_id}`, 'warning');
      }
      setAnomalies(prev => {
        // Dedup by id — only skip if BOTH have a non-null id AND they match
        if (lastMessage.id != null && prev.some(a => a.id != null && a.id === lastMessage.id)) return prev;
        return [{ ...lastMessage, resolved: false }, ...prev];
      });
    }

    // 3. Handle Order Status Changes
    if (lastMessage.type === 'order_status_change') {
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === lastMessage.order_id);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: lastMessage.status };
        return updated;
      });
    }
  }, [lastMessage, isSimulating, addSimLog]);

  const unresolvedAnomalies = useMemo(() => 
    anomalies.filter(a => !a.resolved), 
  [anomalies]);

  const value = {
    agents,
    orders,
    anomalies,
    unresolvedAnomalies,
    unresolvedCount: unresolvedAnomalies.length,
    loading,
    error,
    connected,
    wsReady,
    sendMessage,
    // Simulation Persistence
    isSimulating,
    setIsSimulating,
    simStats,
    setSimStats,
    simLogs,
    addSimLog,
    refreshFleet: fetchData,
    setAnomalies
  };

  return (
    <FleetContext.Provider value={value}>
      {children}
    </FleetContext.Provider>
  );
};
