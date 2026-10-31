/**
 * ControlDock.jsx
 * Floating bottom action dock for interview demonstrations.
 * Connects to the Node.js REST API and Socket.io gateway.
 */
import { useState, useCallback } from 'react';
import { Play, Zap, GitFork, StopCircle, Loader } from 'lucide-react';

const NODE_URL = import.meta.env.VITE_NODE_URL || 'http://localhost:5000';

const dockStyle = {
  position: 'absolute',
  bottom: 28,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(9,9,11,0.92)',
  border: '1px solid rgba(63,63,70,0.8)',
  borderRadius: 18,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 2000,
  boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
};

const DockButton = ({ onClick, loading, disabled, icon: Icon, label, accent, description }) => (
  <div style={{ textAlign: 'center' }}>
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={description}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800,
        background: disabled ? 'rgba(63,63,70,0.3)' : `${accent}18`,
        border: `1px solid ${disabled ? 'rgba(63,63,70,0.4)' : accent + '50'}`,
        color: disabled ? '#52525b' : accent,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        minWidth: 160,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = `${accent}30`;
          e.currentTarget.style.boxShadow = `0 0 20px ${accent}30`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = disabled ? 'rgba(63,63,70,0.3)' : `${accent}18`;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {loading
        ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
        : <Icon size={14} strokeWidth={2.5} />
      }
      {label}
    </button>
  </div>
);

const ControlDock = ({ socketEmit, onSimLog }) => {
  const [simRunning, setSimRunning] = useState(false);
  const [simIntervalId, setSimIntervalId] = useState(null);
  const [loadingChaos, setLoadingChaos] = useState(false);
  const [loadingDispatch, setLoadingDispatch] = useState(false);

  const log = useCallback((msg, type = 'info') => {
    onSimLog?.(msg, type);
  }, [onSimLog]);

  // ── Start / Stop Live Simulation ─────────────────────────────────────────
  const AGENTS = [
    { id: '6a572a90-a1e6-43b5-aa6a-2d4af662f604', lat: 28.6315, lng: 77.2167, name: 'Rohit' },
    { id: 'fe1f1ebf-9f09-4054-82eb-6083f7cb7fd2', lat: 28.5494, lng: 77.2001, name: 'Priya' },
    { id: '25e9f464-62fe-422f-9604-51c254784a86', lat: 28.5708, lng: 77.3261, name: 'Amit'  },
  ];
  const agentState = { current: AGENTS.map((a) => ({ ...a })) };

  const startSimulation = useCallback(() => {
    setSimRunning(true);
    log('▶ Live simulation started — 3 agents transmitting telemetry', 'system');

    // Send initial AVAILABLE status for all agents
    agentState.current.forEach((a) => {
      socketEmit('agent:status_change', { agentId: a.id, status: 'AVAILABLE' });
    });

    const id = setInterval(() => {
      agentState.current = agentState.current.map((a) => {
        const newLat = a.lat + (Math.random() - 0.48) * 0.001;
        const newLng = a.lng + (Math.random() - 0.48) * 0.001;
        const speed = Math.floor(25 + Math.random() * 25);
        const battery = Math.max(10, (a.battery || 100) - 1);

        socketEmit('agent:telemetry', {
          agentId: a.id,
          lat: newLat,
          lng: newLng,
          speed,
          battery,
        });

        log(`📍 ${a.name} → ${speed} km/h  bat:${battery}%`, 'info');
        return { ...a, lat: newLat, lng: newLng, battery };
      });
    }, 2000);

    setSimIntervalId(id);
  }, [socketEmit, log]);

  const stopSimulation = useCallback(() => {
    clearInterval(simIntervalId);
    setSimRunning(false);
    setSimIntervalId(null);
    log('⏹ Simulation stopped', 'system');
  }, [simIntervalId, log]);

  // ── Inject Speed Chaos (Rohit 126 km/h) ─────────────────────────────────
  const injectChaos = useCallback(async () => {
    setLoadingChaos(true);
    log('🚨 Injecting SPEED_ANOMALY: Rohit → 126.4 km/h!', 'warning');

    socketEmit('agent:telemetry', {
      agentId: '6a572a90-a1e6-43b5-aa6a-2d4af662f604',
      lat: 28.6318,
      lng: 77.2171,
      speed: 126.4,
      battery: 92,
    });

    await new Promise((r) => setTimeout(r, 800));
    log('✓ Anomaly dispatched to BullMQ worker — check Supabase anomaly_logs!', 'info');
    setLoadingChaos(false);
  }, [socketEmit, log]);

  // ── Concurrent Dispatch Test ─────────────────────────────────────────────
  const triggerConcurrentDispatch = useCallback(async () => {
    setLoadingDispatch(true);
    log('⚡ Creating 2 orders near Connaught Place...', 'system');

    try {
      const [r1, r2] = await Promise.all([
        fetch(`${NODE_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickupLat: 28.6315, pickupLng: 77.2167, dropLat: 28.6400, dropLng: 77.2300 }),
        }),
        fetch(`${NODE_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickupLat: 28.6320, pickupLng: 77.2180, dropLat: 28.6450, dropLng: 77.2350 }),
        }),
      ]);

      const [o1, o2] = await Promise.all([r1.json(), r2.json()]);
      log(`✓ Order A: ${o1.order?.id?.slice(0, 8)}... | Order B: ${o2.order?.id?.slice(0, 8)}...`, 'info');

      // Fire both auto-assign calls concurrently (the race-condition test)
      log('🔥 Firing concurrent auto-assign — watch race condition resolution!', 'warning');

      const [a1, a2] = await Promise.allSettled([
        fetch(`${NODE_URL}/api/orders/${o1.order.id}/auto-assign`, { method: 'POST' }).then((r) => r.json()),
        fetch(`${NODE_URL}/api/orders/${o2.order.id}/auto-assign`, { method: 'POST' }).then((r) => r.json()),
      ]);

      if (a1.status === 'fulfilled') {
        log(`✅ Order A → Agent ${a1.value?.assignedAgentId?.slice(0, 8)}... (${a1.value?.agentEmail?.split('@')[0]})`, 'info');
      }
      if (a2.status === 'fulfilled') {
        log(`✅ Order B → Agent ${a2.value?.assignedAgentId?.slice(0, 8)}... (${a2.value?.agentEmail?.split('@')[0]})`, 'info');
      }

      const bothSameAgent =
        a1.status === 'fulfilled' &&
        a2.status === 'fulfilled' &&
        a1.value?.assignedAgentId === a2.value?.assignedAgentId;

      if (bothSameAgent) {
        log('❌ DOUBLE ASSIGNMENT DETECTED — lock failure!', 'error');
      } else {
        log('✅ PASS — No race condition. Different agents assigned.', 'info');
      }
    } catch (err) {
      log(`Error: ${err.message}`, 'error');
    } finally {
      setLoadingDispatch(false);
    }
  }, [log]);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={dockStyle}>
        {/* Label */}
        <div style={{
          fontSize: 9, fontWeight: 800, color: '#52525b', letterSpacing: '0.15em',
          textTransform: 'uppercase', paddingRight: 8,
          borderRight: '1px solid rgba(63,63,70,0.6)',
        }}>
          DEMO DOCK
        </div>

        {!simRunning ? (
          <DockButton
            icon={Play} label="Start Live Simulation" accent="#10b981"
            description="Stream live GPS telemetry from 3 agents to the map"
            onClick={startSimulation}
          />
        ) : (
          <DockButton
            icon={StopCircle} label="Stop Simulation" accent="#f43f5e"
            description="Stop the live simulation stream"
            onClick={stopSimulation}
          />
        )}

        <DockButton
          icon={Zap} label="Inject Speed Chaos" accent="#f43f5e"
          description="Trigger 126.4 km/h anomaly on Rohit → BullMQ → Supabase"
          loading={loadingChaos}
          onClick={injectChaos}
        />

        <DockButton
          icon={GitFork} label="Concurrent Dispatch" accent="#6366f1"
          description="Create 2 simultaneous orders and fire concurrent auto-assign"
          loading={loadingDispatch}
          onClick={triggerConcurrentDispatch}
        />
      </div>
    </>
  );
};

export default ControlDock;

