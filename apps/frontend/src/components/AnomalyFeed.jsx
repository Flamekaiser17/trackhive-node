/**
 * AnomalyFeed.jsx
 * Right-side slide-in drawer showing live SPEED_ANOMALY incidents
 * streamed from the Node.js Socket.io backend.
 */
import { useState } from 'react';
import { AlertTriangle, X, ChevronRight, CheckCircle } from 'lucide-react';

const drawerStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: 320,
  background: 'rgba(9,9,11,0.95)',
  borderLeft: '1px solid rgba(63,63,70,0.7)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1000,
  overflowY: 'hidden',
};

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return '--:--:--'; }
};

const IncidentCard = ({ anomaly, onAck }) => {
  const isCritical = anomaly.speed > 120;
  const borderColor = isCritical ? '#f43f5e' : '#f59e0b';

  return (
    <div style={{
      padding: '14px 16px',
      borderLeft: `3px solid ${borderColor}`,
      background: anomaly.acknowledged ? 'rgba(255,255,255,0.02)' : `${borderColor}08`,
      borderBottom: '1px solid rgba(63,63,70,0.4)',
      opacity: anomaly.acknowledged ? 0.5 : 1,
      transition: 'all 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${borderColor}20`, border: `1px solid ${borderColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={13} color={borderColor} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
              {anomaly.type?.replace(/_/g, ' ')}
            </p>
            <p style={{ fontSize: 10, color: '#71717a', fontFamily: 'monospace', marginTop: 1 }}>
              {formatTime(anomaly.detectedAt)}
            </p>
          </div>
        </div>
        {isCritical && (
          <span style={{
            fontSize: 9, fontWeight: 900, padding: '2px 7px',
            background: '#f43f5e20', color: '#f43f5e',
            borderRadius: 99, border: '1px solid #f43f5e40', letterSpacing: '0.05em',
          }}>
            CRITICAL
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 700 }}>Speed</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: borderColor }}>{Math.round(anomaly.speed)}</p>
          <p style={{ fontSize: 9, color: '#52525b' }}>km/h</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 700 }}>Agent ID</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', fontFamily: 'monospace' }}>
            {anomaly.agentId?.slice(0, 8)}...
          </p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 700 }}>Location</p>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa' }}>
            {anomaly.lat?.toFixed(3)}, {anomaly.lng?.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Acknowledge button */}
      {!anomaly.acknowledged && (
        <button
          onClick={() => onAck(anomaly.id)}
          style={{
            width: '100%', padding: '7px 0', fontSize: 10, fontWeight: 800,
            background: 'transparent', border: `1px solid rgba(63,63,70,0.7)`,
            borderRadius: 8, color: '#a1a1aa', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.color = '#10b981';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(63,63,70,0.7)';
            e.currentTarget.style.color = '#a1a1aa';
          }}
        >
          <CheckCircle size={11} /> ACKNOWLEDGE
        </button>
      )}
    </div>
  );
};

const AnomalyFeed = ({ anomalies = [], onAcknowledge, open = true, onClose }) => {
  const unresolved = anomalies.filter((a) => !a.acknowledged);

  if (!open) return null;

  return (
    <div style={drawerStyle}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(63,63,70,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#f43f5e" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Incident Feed</span>
          {unresolved.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '2px 8px',
              background: '#f43f5e20', color: '#f43f5e',
              borderRadius: 99, border: '1px solid #f43f5e40',
            }}>
              {unresolved.length} LIVE
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Feed */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {anomalies.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 12, color: '#52525b', fontWeight: 600 }}>All Clear — No Incidents</p>
          </div>
        ) : (
          anomalies.map((a) => (
            <IncidentCard key={a.id} anomaly={a} onAck={onAcknowledge} />
          ))
        )}
      </div>
    </div>
  );
};

export default AnomalyFeed;

