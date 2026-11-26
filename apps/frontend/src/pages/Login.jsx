import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Mail, Lock, AlertTriangle, Hexagon, Zap, Shield, Bike } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loginUser, registerUser, exploreDemo } from '../api/endpoints';

/* ── Animated grid background dots ─────────────────────────── */
const GridBg = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    {/* Grid lines */}
    <div className="login-grid-overlay" />

    {/* Radial glow blobs */}
    <div style={{
      position: 'absolute', top: '-20%', left: '-10%',
      width: 600, height: 600, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
      filter: 'blur(40px)',
    }} />
    <div style={{
      position: 'absolute', bottom: '-20%', right: '-10%',
      width: 500, height: 500, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)',
      filter: 'blur(40px)',
    }} />

    {/* Floating particles */}
    {[...Array(18)].map((_, i) => (
      <motion.div
        key={i}
        style={{
          position: 'absolute',
          width: i % 3 === 0 ? 3 : 2,
          height: i % 3 === 0 ? 3 : 2,
          borderRadius: '50%',
          background: i % 2 === 0 ? 'rgba(108,99,255,0.5)' : 'rgba(0,212,170,0.4)',
          left: `${(i * 17 + 5) % 95}%`,
          top: `${(i * 23 + 10) % 90}%`,
        }}
        animate={{
          y: [-10, 10, -10],
          opacity: [0.3, 0.8, 0.3],
        }}
        transition={{
          duration: 3 + (i % 4),
          repeat: Infinity,
          delay: i * 0.3,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

/* ── Floating label input ───────────────────────────────────── */
const FloatingInput = ({ id, type, label, icon: Icon, value, onChange, required, minLength }) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const isFloated = focused || hasValue;

  return (
    <div style={{ position: 'relative', marginBottom: 4 }}>
      {/* Icon */}
      <div style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: focused ? '#6C63FF' : '#8B8BA7',
        transition: 'color 0.2s', zIndex: 2, pointerEvents: 'none',
      }}>
        <Icon size={16} />
      </div>

      {/* Floating label */}
      <label
        htmlFor={id}
        style={{
          position: 'absolute',
          left: 44,
          top: isFloated ? 8 : '50%',
          transform: isFloated ? 'none' : 'translateY(-50%)',
          fontSize: isFloated ? 10 : 14,
          fontWeight: isFloated ? 700 : 400,
          color: focused ? '#6C63FF' : '#8B8BA7',
          textTransform: isFloated ? 'uppercase' : 'none',
          letterSpacing: isFloated ? '0.08em' : 'normal',
          transition: 'all 0.2s ease',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {label}
      </label>

      {/* Input */}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 54,
          paddingTop: hasValue || focused ? 20 : 0,
          paddingBottom: 8,
          paddingLeft: 44,
          paddingRight: 16,
          background: 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${focused ? '#6C63FF' : '#2A2A3A'}`,
          borderRadius: 'var(--radius-md)',
          color: '#fff',
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: focused ? '0 0 0 3px rgba(108,99,255,0.12)' : 'none',
        }}
      />
    </div>
  );
};

/* ── Main Login & Registration component ────────────────────── */
const Login = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('AGENT');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (localStorage.getItem('access_token') && onLogin) onLogin();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isSignUp) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await registerUser(email, password, role);
        setSuccessMsg('Account created successfully! Redirecting…');
      } else {
        await loginUser(email, password);
      }
      if (onLogin) onLogin();
    } catch (err) {
      const status = err.response?.status;
      const apiErrorMsg = err.response?.data?.error;
      
      if (apiErrorMsg) {
        setError(apiErrorMsg);
      } else if (status === 401) {
        setError('Invalid credentials. Check your email and password.');
      } else if (status === 409) {
        setError('Email already registered. Please sign in instead.');
      } else if (status === 500) {
        setError('Server error. Try again later.');
      } else {
        setError('Cannot connect to server.');
      }
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSuccessMsg('');
    setDemoLoading(true);
    try {
      await exploreDemo();
      if (onLogin) onLogin();
    } catch (err) {
      setError('Demo login failed. Cannot connect to server.');
      setDemoLoading(false);
    }
  };

  return (
    <div
      className="login-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        padding: '24px 16px',
      }}
    >
      <GridBg />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="login-card"
        style={{ width: 440, padding: '36px 32px', position: 'relative', zIndex: 10 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(108,99,255,0.3)', '0 0 40px rgba(108,99,255,0.6)', '0 0 20px rgba(108,99,255,0.3)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{
              width: 56, height: 56,
              background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Hexagon size={28} color="#fff" fill="#fff" />
          </motion.div>

          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>
            TrackHive
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Autonomous Delivery & Fleet Operations
          </p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 10, padding: '3px 10px',
            background: 'rgba(46,213,115,0.08)',
            border: '1px solid rgba(46,213,115,0.2)',
            borderRadius: 99,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ED573', animation: 'blink-dot 2s ease infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#2ED573', letterSpacing: '0.08em' }}>JWT AUTH SECURED</span>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          border: '1px solid #2A2A3A',
        }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: !isSignUp ? '#6C63FF' : 'transparent',
              color: !isSignUp ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: isSignUp ? '#6C63FF' : 'transparent',
              color: isSignUp ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Feedback messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              style={{
                background: 'rgba(255,71,87,0.1)',
                border: '1px solid rgba(255,71,87,0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                overflow: 'hidden',
              }}
            >
              <AlertTriangle size={15} color="#FF4757" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#FF4757' }}>{error}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              style={{
                background: 'rgba(46,213,115,0.1)',
                border: '1px solid rgba(46,213,115,0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                overflow: 'hidden',
              }}
            >
              <Zap size={15} color="#2ED573" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2ED573' }}>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FloatingInput
            id="email"
            type="email"
            label="Email Address"
            icon={Mail}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          {/* Role selector for registration */}
          {isSignUp && (
            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Account Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setRole('AGENT')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: `1.5px solid ${role === 'AGENT' ? '#6C63FF' : '#2A2A3A'}`,
                    background: role === 'AGENT' ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.02)',
                    color: role === 'AGENT' ? '#fff' : '#8B8BA7',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Bike size={15} color={role === 'AGENT' ? '#6C63FF' : '#8B8BA7'} />
                  Delivery Agent
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: `1.5px solid ${role === 'ADMIN' ? '#6C63FF' : '#2A2A3A'}`,
                    background: role === 'ADMIN' ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.02)',
                    color: role === 'ADMIN' ? '#fff' : '#8B8BA7',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Shield size={15} color={role === 'ADMIN' ? '#6C63FF' : '#8B8BA7'} />
                  Ops Admin
                </button>
              </div>
            </div>
          )}

          <FloatingInput
            id="password"
            type="password"
            label="Password (min 6 characters)"
            icon={Lock}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {isSignUp && (
            <FloatingInput
              id="confirmPassword"
              type="password"
              label="Confirm Password"
              icon={Lock}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          )}

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(108,99,255,0.45)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              width: '100%',
              height: 50,
              background: loading
                ? 'rgba(108,99,255,0.5)'
                : 'linear-gradient(135deg, #6C63FF 0%, #8B85FF 100%)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '0.04em',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
                {isSignUp ? 'Creating Account…' : 'Authenticating…'}
              </>
            ) : isSignUp ? (
              <>
                <UserPlus size={17} />
                Create TrackHive Account
              </>
            ) : (
              <>
                <LogIn size={17} />
                Sign In to TrackHive
              </>
            )}
          </motion.button>
        </form>

        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.05em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Demo Button */}
        <motion.button
          onClick={handleDemo}
          disabled={demoLoading || loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            height: 48,
            background: 'rgba(255,165,2,0.1)',
            border: '1.5px solid rgba(255,165,2,0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FFA502',
            fontSize: 13,
            fontWeight: 800,
            cursor: (demoLoading || loading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            letterSpacing: '0.04em',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {demoLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,165,2,0.3)', borderTopColor: '#FFA502' }}
              />
              Loading Demo…
            </>
          ) : (
            <>
              <Zap size={16} />
              ⚡ Instant 1-Click Demo (Admin)
            </>
          )}
        </motion.button>

        {/* Footer */}
        <p style={{
          textAlign: 'center', fontSize: 10, color: 'var(--text-faint)',
          marginTop: 22, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Dual Token Rotation · Delhi NCR Grid Active
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
