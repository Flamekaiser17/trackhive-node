/**
 * Dashboard.jsx — Phase 4 Logistics Operations Deck
 * 
 * High-performance, dark-mode Logistics Operations Deck:
 *   - CartoDB Dark Matter tiles with smooth SVG vehicle pulse markers
 *   - Glassmorphic top telemetry KPI bar
 *   - Live anomaly incident slide-in drawer
 *   - Floating interactive control dock (simulation, speed chaos, concurrent dispatch)
 *   - Socket.io lifecycle listeners connected directly to the Node.js backend (port 5000)
 */

import { useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, AlertTriangle, Layers, BarChart3, 
  MapPin, CheckCircle, X, ChevronRight, Users, Package, Zap 
} from 'lucide-react';

import useNodeSocket from '../hooks/useNodeSocket';
import FleetMap from '../components/FleetMap';
import MetricsBar from '../components/MetricsBar';
import AnomalyFeed from '../components/AnomalyFeed';
import ControlDock from '../components/ControlDock';
import { FleetContext } from '../context/FleetContext';

const NODE_BACKEND = import.meta.env.VITE_NODE_URL || 'http://localhost:5000';

const Dashboard = ({ onNavigate }) => {
  const { orders: contextOrders } = useContext(FleetContext);

  // View mode: 'deck' (Command Center) or 'analytics' (Legacy HUD)
  const [viewMode, setViewMode] = useState('deck');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [simLogs, setSimLogs] = useState([]);

  // Socket.io connection to Node.js backend
  const {
    connected,
    agentPositions,
    statusEvents,
    assignEvents,
    anomalyEvents,
    setAnomalyEvents,
    latencyMs,
    emit,
  } = useNodeSocket();

  // Fetch active orders from Node.js backend on mount & periodically
  const fetchNodeOrders = useCallback(async () => {
    try {
      const res = await fetch(`${NODE_BACKEND}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        setActiveOrders(data.orders || []);
      }
    } catch {
      // Fallback to context orders if Node backend request fails
      if (contextOrders?.length) setActiveOrders(contextOrders);
    }
  }, [contextOrders]);

  useEffect(() => {
    fetchNodeOrders();
    const interval = setInterval(fetchNodeOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchNodeOrders]);

  // When an order is assigned via socket, refresh orders
  useEffect(() => {
    if (assignEvents.length > 0) {
      fetchNodeOrders();
    }
  }, [assignEvents, fetchNodeOrders]);

  // Auto-open drawer when a new critical anomaly is detected
  const lastAnomalyId = useRef(null);
  useEffect(() => {
    if (anomalyEvents.length > 0) {
      const latest = anomalyEvents[0];
      if (latest && latest.id !== lastAnomalyId.current) {
        lastAnomalyId.current = latest.id;
        setDrawerOpen(true);
      }
    }
  }, [anomalyEvents]);

  const handleAcknowledge = useCallback((id) => {
    setAnomalyEvents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, [setAnomalyEvents]);

  const handleSimLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setSimLogs((prev) => [{ id: Date.now(), time, msg, type }, ...prev].slice(0, 50));
  }, []);

  const anomalyCount = useMemo(
    () => anomalyEvents.filter((a) => !a.acknowledged).length,
    [anomalyEvents]
  );

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#09090b',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Sub-Header: Mode Switcher & Backend Health ──────────────────────── */}
      <div style={{
        height: 42,
        background: 'rgba(18,18,26,0.95)',
        borderBottom: '1px solid rgba(63,63,70,0.4)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Left: Engine Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            color: connected ? '#10b981' : '#f43f5e',
          }}>
            <Radio size={12} className={connected ? 'animate-pulse' : ''} />
            <span>{connected ? 'ORCHESTRATION ENGINE LIVE' : 'ENGINE OFFLINE'}</span>
          </div>
          <span style={{ fontSize: 11, color: '#52525b' }}>|</span>
          <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'monospace' }}>
            ws://localhost:5000 • Upstash Redis GEO • Supabase ACID
          </span>
        </div>

        {/* Right: View Mode Toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(24,24,27,0.8)', padding: 3, borderRadius: 8, border: '1px solid rgba(63,63,70,0.5)' }}>
          <button
            onClick={() => setViewMode('deck')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              background: viewMode === 'deck' ? '#6366f1' : 'transparent',
              color: viewMode === 'deck' ? '#fff' : '#71717a',
              transition: 'all 0.2s',
            }}
          >
            <Layers size={12} />
            OPERATIONS DECK
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              background: viewMode === 'analytics' ? '#6366f1' : 'transparent',
              color: viewMode === 'analytics' ? '#fff' : '#71717a',
              transition: 'all 0.2s',
            }}
          >
            <BarChart3 size={12} />
            ANALYTICS HUD
          </button>
        </div>
      </div>

      {/* ── View 1: Logistics Operations Deck (Phase 4 Primary) ──────────────── */}
      {viewMode === 'deck' && (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Top Telemetry KPI Bar */}
          <MetricsBar
            agentPositions={agentPositions}
            anomalyCount={anomalyCount}
            latencyMs={latencyMs}
            orders={activeOrders}
          />

          {/* Interactive Map Canvas + Drawer Area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            
            {/* Map Container (width animates on drawer open) */}
            <div style={{
              position: 'absolute',
              inset: 0,
              right: drawerOpen ? 320 : 0,
              transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              <FleetMap
                agentPositions={agentPositions}
                agents={[]}
                orders={activeOrders}
              />
            </div>

            {/* Anomaly Drawer Toggle Button (when closed) */}
            {!drawerOpen && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setDrawerOpen(true)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  zIndex: 1000,
                  background: anomalyCount > 0 ? 'rgba(244,63,94,0.18)' : 'rgba(24,24,27,0.85)',
                  border: `1px solid ${anomalyCount > 0 ? '#f43f5e60' : 'rgba(63,63,70,0.8)'}`,
                  borderRadius: 12,
                  padding: '9px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                <AlertTriangle size={15} color={anomalyCount > 0 ? '#f43f5e' : '#71717a'} />
                INCIDENTS
                {anomalyCount > 0 && (
                  <span style={{
                    background: '#f43f5e',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: 99,
                  }}>
                    {anomalyCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Anomaly Feed Drawer */}
            <AnomalyFeed
              anomalies={anomalyEvents}
              onAcknowledge={handleAcknowledge}
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />

            {/* Real-time Activity Log (bottom-left overlay) */}
            {simLogs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  bottom: 100,
                  left: 20,
                  width: 360,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: 'rgba(9,9,11,0.92)',
                  border: '1px solid rgba(63,63,70,0.6)',
                  borderRadius: 12,
                  backdropFilter: 'blur(16px)',
                  zIndex: 1000,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{
                  padding: '8px 14px 6px',
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#52525b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  borderBottom: '1px solid rgba(63,63,70,0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>Real-Time Dispatch & Telemetry Log</span>
                  <button
                    onClick={() => setSimLogs([])}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
                {simLogs.slice(0, 10).map((l) => (
                  <div key={l.id} style={{
                    padding: '4px 14px',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                  }}>
                    <span style={{ fontSize: 9, color: '#52525b', fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>
                      {l.time}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color:
                        l.type === 'warning' ? '#f59e0b' :
                        l.type === 'system'  ? '#818cf8' :
                        l.type === 'error'   ? '#f43f5e' : '#a1a1aa',
                    }}>
                      {l.msg}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Interactive Control Dock (bottom center) */}
            <ControlDock socketEmit={emit} onSimLog={handleSimLog} />
          </div>
        </div>
      )}

      {/* ── View 2: Analytics HUD (Legacy Overview) ─────────────────────────── */}
      {viewMode === 'analytics' && (
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', marginBottom: 8 }}>
                <Users size={18} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>AVAILABLE FLEET</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>
                {Object.keys(agentPositions).length || 3}
              </p>
              <p style={{ fontSize: 11, color: '#71717a' }}>Connected to Redis Spatial Index</p>
            </div>

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6366f1', marginBottom: 8 }}>
                <Package size={18} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>ACTIVE DELIVERIES</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>
                {activeOrders.length}
              </p>
              <p style={{ fontSize: 11, color: '#71717a' }}>Atomic ACID Assignment Pipeline</p>
            </div>

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f43f5e', marginBottom: 8 }}>
                <AlertTriangle size={18} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>SPEED ANOMALIES</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>
                {anomalyCount}
              </p>
              <p style={{ fontSize: 11, color: '#71717a' }}>BullMQ Decoupled Worker Queue</p>
            </div>
          </div>

          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              Active Orders List (Supabase PostgreSQL)
            </h3>
            {activeOrders.length === 0 ? (
              <p style={{ fontSize: 12, color: '#71717a' }}>No orders found. Click "Trigger Concurrent Dispatch" in Operations Deck to generate live orders.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 12, textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                    <th style={{ padding: '8px 0' }}>Order ID</th>
                    <th>Status</th>
                    <th>Assigned Agent</th>
                    <th>Pickup</th>
                    <th>Drop</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #27272a', color: '#e4e4e7' }}>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{o.id?.slice(0, 8)}...</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                          background: o.status === 'ASSIGNED' ? '#6366f120' : '#10b98120',
                          color: o.status === 'ASSIGNED' ? '#818cf8' : '#34d399',
                        }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {o.agent?.user?.email || o.agentId?.slice(0, 8) || 'Unassigned'}
                      </td>
                      <td>{o.pickupLat?.toFixed(3)}, {o.pickupLng?.toFixed(3)}</td>
                      <td>{o.dropLat?.toFixed(3)}, {o.dropLng?.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
