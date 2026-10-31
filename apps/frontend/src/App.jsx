import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Fleet from './pages/Fleet';
import Orders from './pages/Orders';
import Anomalies from './pages/Anomalies';
import Simulator from './pages/Simulator';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { FleetContext } from './context/FleetContext';
import useAgents from './hooks/useAgents';
import { getProfile } from './api/endpoints';

/* ── Real-time init splash (shown while WS handshake happens) ─── */
const WsSplash = () => {
  // 15-second automatic fallback refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn("WS_FALLBACK: Initializing took too long, auto-refreshing.");
      window.location.reload();
    }, 15000);

    // Cancel timer immediately if data loads and this component unmounts
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      height: '100vh', background: '#050508',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      {/* Animated pulse ring */}
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        <motion.div
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid #6C63FF',
          }}
        />
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6C63FF, #00D4AA)',
        }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontSize: 13, fontWeight: 800, letterSpacing: '0.18em',
          color: '#fff', textTransform: 'uppercase', marginBottom: 6,
        }}>
          🚀 Initializing real-time system...
        </p>
        <p style={{
          fontSize: 11, color: '#8B8BA7', fontWeight: 500, letterSpacing: '0.06em',
        }}>
          Establishing secure telemetry stream
        </p>
      </div>

      {/* Animated progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2], y: [0, -5, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#6C63FF' }}
          />
        ))}
      </div>

      {/* Manual Refresh Fallback Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1 }} // Fade-in gracefully so it's not jarring
        onClick={() => window.location.reload()}
        style={{
          background: 'rgba(108, 99, 255, 0.1)',
          border: '1px solid rgba(108, 99, 255, 0.3)',
          color: '#6C63FF',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.05em',
          transition: 'all 0.2s ease-in-out',
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'rgba(108, 99, 255, 0.2)';
          e.target.style.borderColor = 'rgba(108, 99, 255, 0.5)';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'rgba(108, 99, 255, 0.1)';
          e.target.style.borderColor = 'rgba(108, 99, 255, 0.3)';
        }}
      >
        🔄 Refresh Now
      </motion.button>
    </div>
  );
};

const AuthenticatedApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [focusedAgentId, setFocusedAgentId] = useState(null);

  const { agents } = useAgents();
  const { unresolvedCount, orders, wsReady } = useContext(FleetContext);

  const handleNavigate = (tab, agentId = null) => {
    if (tab === 'live-map') setFocusedAgentId(agentId);
    setActiveTab(tab);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':  return <Dashboard onNavigate={handleNavigate} />;
      case 'live-map':   return <LiveMap agents={agents} orders={orders} focusedAgentId={focusedAgentId} />;
      case 'fleet':      return <Fleet agents={agents} orders={orders} onNavigate={handleNavigate} />;
      case 'orders':     return <Orders />;
      case 'anomalies':  return <Anomalies />;
      case 'simulator':  return <Simulator />;
      case 'settings':   return <Settings />;
      default:           return <Dashboard />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!wsReady ? (
        <motion.div
          key="ws-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <WsSplash />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          style={{ height: '100vh' }}
        >
          <MainLayout
            currentTab={activeTab}
            onTabChange={handleNavigate}
            anomalyCount={unresolvedCount}
          >
            {renderPage()}
          </MainLayout>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TrackHiveApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsVerifying(false);
        return;
      }
      // Token exists — treat as authenticated immediately (optimistic auth).
      // Our token format is `token-<userId>` (not JWT), so we don't need to decode.
      // We still fire a background profile check, but we NEVER log the user out
      // on a transient network failure — only on explicit 401.
      setIsAuthenticated(true);
      setIsVerifying(false);
      try {
        await getProfile();
      } catch (err) {
        // Only hard-logout on 401 Unauthorized. Network errors (503, timeout, etc.)
        // should not log the user out on the live Render deployment.
        if (err?.response?.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setIsAuthenticated(false);
        }
      }
    };
    verifySession();

    const handleLogout = () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setIsAuthenticated(false);
    };
    window.addEventListener('auth_logout', handleLogout);
    return () => window.removeEventListener('auth_logout', handleLogout);
  }, []);

  if (isVerifying) {
    return (
      <div style={{ height: '100vh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.2em' }}>AUTHENTICATING...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return <AuthenticatedApp />;
};

export default TrackHiveApp;