/**
 * CommandCenter.jsx
 * Full-screen Phase 4 dashboard: CartoDB map + live KPIs + anomaly drawer + control dock.
 * Lives in src/pages/ as a standalone page wired into App.jsx.
 * Does NOT touch or break any existing page/component.
 */
import { useState, useCallback, useContext } from 'react';
import { AlertTriangle, Radio, X } from 'lucide-react';

import useNodeSocket from '../hooks/useNodeSocket';
import FleetMap from '../components/FleetMap';
import MetricsBar from '../components/MetricsBar';
import AnomalyFeed from '../components/AnomalyFeed';
import ControlDock from '../components/ControlDock';
import { FleetContext } from '../context/FleetContext';

const CommandCenter = () => {
  const { orders } = useContext(FleetContext);

  const {
    connected,
    agentPositions,
    anomalyEvents,
    setAnomalyEvents,
    latencyMs,
    emit,
  } = useNodeSocket();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [simLogs, setSimLogs] = useState([]);

  const anomalyCount = anomalyEvents.filter((a) => !a.acknowledged).length;

  const handleAcknowledge = useCallback((id) => {
    setAnomalyEvents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, [setAnomalyEvents]);

  const handleSimLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setSimLogs((prev) => [{ id: Date.now(), time, msg, type }, ...prev].slice(0, 80));
  }, []);

  // Auto-open drawer when new anomaly arrives
  const prevAnomalyCount = anomalyEvents.length;
  if (anomalyEvents.length > prevAnomalyCount && !drawerOpen) {
    setDrawerOpen(true);
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#09090b', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Connection Status Banner ──────────────────────────────────────── */}
      {!connected && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.3)',
          padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontWeight: 700, color: '#fca5a5', flexShrink: 0,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'fleetPulse 1.5s infinite' }} />
          Connecting to TrackHive Engine (localhost:5000)...
          <span style={{ color: '#71717a', fontWeight: 500 }}>
            &nbsp;— Start the backend with <code style={{ background: '#18181b', padding: '1px 5px', borderRadius: 4 }}>npm run dev</code>
          </span>
        </div>
      )}

      {connected && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.2)',
          padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, fontWeight: 700, color: '#6ee7b7', flexShrink: 0,
        }}>
          <Radio size={12} color="#10b981" />
          TrackHive Engine Connected
          <span style={{ color: '#52525b' }}>• Port 5000 • Socket.io v4 • Upstash Redis • Supabase PostgreSQL</span>
        </div>
      )}

      {/* ── KPI Metrics Bar ───────────────────────────────────────────────── */}
      <MetricsBar
        agentPositions={agentPositions}
        anomalyCount={anomalyCount}
        latencyMs={latencyMs}
        orders={orders}
      />

      {/* ── Map + Drawer Layout ───────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Fleet Map (full area) */}
        <div style={{
          position: 'absolute', inset: 0,
          right: drawerOpen ? 320 : 0,
          transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <FleetMap agentPositions={agentPositions} agents={[]} orders={orders} />
        </div>

        {/* Anomaly Drawer Toggle Button */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1500,
              background: anomalyCount > 0 ? 'rgba(244,63,94,0.15)' : 'rgba(24,24,27,0.85)',
              border: `1px solid ${anomalyCount > 0 ? '#f43f5e50' : 'rgba(63,63,70,0.7)'}`,
              borderRadius: 12, padding: '8px 14px', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700,
              backdropFilter: 'blur(12px)',
            }}
          >
            <AlertTriangle size={14} color={anomalyCount > 0 ? '#f43f5e' : '#71717a'} />
            Incidents
            {anomalyCount > 0 && (
              <span style={{
                background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 900,
                width: 18, height: 18, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {anomalyCount}
              </span>
            )}
          </button>
        )}

        {/* Anomaly Feed Drawer */}
        {drawerOpen && (
          <AnomalyFeed
            anomalies={anomalyEvents}
            onAcknowledge={handleAcknowledge}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {/* ── Activity Log (bottom-left) ──────────────────────────────────── */}
        {simLogs.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 100, left: 16,
            width: 340, maxHeight: 180, overflowY: 'auto',
            background: 'rgba(9,9,11,0.88)',
            border: '1px solid rgba(63,63,70,0.6)',
            borderRadius: 12, backdropFilter: 'blur(12px)',
            zIndex: 1500, padding: '10px 0',
          }}>
            <div style={{
              padding: '0 14px 6px', fontSize: 9, fontWeight: 800, color: '#52525b',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              borderBottom: '1px solid rgba(63,63,70,0.4)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Activity Log</span>
              <button
                onClick={() => setSimLogs([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0 }}
              >
                <X size={10} />
              </button>
            </div>
            {simLogs.slice(0, 12).map((l) => (
              <div key={l.id} style={{
                padding: '4px 14px', display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 9, color: '#3f3f46', fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>
                  {l.time}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: l.type === 'warning' ? '#fbbf24' : l.type === 'system' ? '#818cf8' : l.type === 'error' ? '#f87171' : '#a1a1aa',
                }}>
                  {l.msg}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Control Dock ──────────────────────────────────────────────────── */}
        <ControlDock socketEmit={emit} onSimLog={handleSimLog} />
      </div>
    </div>
  );
};

export default CommandCenter;

