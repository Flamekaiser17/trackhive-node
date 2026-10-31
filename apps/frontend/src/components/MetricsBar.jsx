/**
 * MetricsBar.jsx
 * Glassmorphic top KPI bar for live fleet telemetry stats.
 */
import { useMemo } from 'react';
import { Users, Package, AlertTriangle, Wifi, Zap } from 'lucide-react';

const glass = {
  background: 'rgba(24,24,27,0.85)',
  border: '1px solid rgba(63,63,70,0.7)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 12,
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flex: '1 1 auto',
  minWidth: 140,
};

const KPI = ({ icon: Icon, label, value, accent, badge }) => (
  <div style={glass}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `${accent}18`,
      border: `1px solid ${accent}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={16} color={accent} strokeWidth={2.5} />
    </div>
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{value}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px',
            background: `${accent}20`, color: accent,
            borderRadius: 99, border: `1px solid ${accent}40`,
          }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  </div>
);

const MetricsBar = ({ agentPositions = {}, anomalyCount = 0, latencyMs = null, orders = [] }) => {
  const liveAgentCount = Object.keys(agentPositions).length;

  const avgSpeed = useMemo(() => {
    const values = Object.values(agentPositions).map((a) => a.speed || 0).filter((s) => s > 0);
    if (!values.length) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [agentPositions]);

  const inFlightOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_TRANSIT').length;
  }, [orders]);

  const latencyLabel = latencyMs != null
    ? latencyMs < 100 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`
    : '—';

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 20px', flexWrap: 'wrap',
      background: 'rgba(9,9,11,0.9)',
      borderBottom: '1px solid rgba(63,63,70,0.5)',
    }}>
      <KPI icon={Users}        label="Agents Online"   value={liveAgentCount} accent="#10b981" badge="Live" />
      <KPI icon={Package}      label="Orders In-Flight" value={inFlightOrders}  accent="#6366f1" />
      <KPI icon={Zap}          label="Avg Speed"        value={`${avgSpeed} km/h`} accent="#f59e0b" />
      <KPI icon={Wifi}         label="Net Latency"      value={latencyLabel}    accent="#22d3ee"
        badge={latencyMs != null && latencyMs < 200 ? 'Good' : latencyMs != null ? 'High' : null}
      />
      <KPI icon={AlertTriangle} label="Anomalies"       value={anomalyCount}
        accent={anomalyCount > 0 ? '#f43f5e' : '#71717a'}
        badge={anomalyCount > 0 ? 'Action!' : null}
      />
    </div>
  );
};

export default MetricsBar;

