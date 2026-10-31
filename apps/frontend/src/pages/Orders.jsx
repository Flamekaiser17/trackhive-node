import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCw, X, Filter, ArrowRight, Calendar,
  CheckCircle2, Clock, MapPin, User,
} from 'lucide-react';
import { getOrders } from '../api/endpoints';
import StatusBadge from '../components/StatusBadge';

/* ── Helpers ─────────────────────────────────────────────────── */
const fmtDate = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return '—'; }
};

const fmtCoord = (v) => (v != null ? Number(v).toFixed(4) : '—');

const truncId = (id) => id ? `#OR-${String(id).slice(0, 6).toUpperCase()}` : '—';

/* ── Stat pill component ─────────────────────────────────────── */
const StatPill = ({ label, value, active, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, minWidth: 140, padding: '16px 20px',
      background: active ? 'rgba(108,99,255,0.12)' : 'var(--bg-card)',
      border: `1px solid ${active ? 'rgba(108,99,255,0.4)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column', gap: 6,
      cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      textAlign: 'left',
      boxShadow: active ? '0 8px 24px rgba(108,99,255,0.15)' : 'none',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
  >
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: active ? 'var(--primary)' : 'var(--text-muted)'
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 26, fontWeight: 800, color: active ? 'var(--text-primary)' : 'var(--text-primary)',
      lineHeight: 1
    }}>
      {value}
    </span>
    {active && (
      <motion.div
        layoutId="active-pill-dot"
        style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', marginTop: 4 }}
      />
    )}
  </button>
);

/* ── Custom select for filters ───────────────────────────────── */
const CustomSelect = ({ value, options, onChange, icon: Icon }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeOpt = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Icon size={14} color="var(--text-muted)" />
        {activeOpt.label}
        <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', minWidth: 160, overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
            }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: '100%', padding: '10px 14px', textAlign: 'left',
                  background: value === opt.value ? 'rgba(108,99,255,0.12)' : 'transparent',
                  border: 'none', color: value === opt.value ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: value === opt.value ? 700 : 500, cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Skeleton rows ───────────────────────────────────────────── */
const SkeletonRows = ({ count = 8 }) => (
  <>
    {[...Array(count)].map((_, i) => (
      <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,58,0.5)' }}>
        {[140, 100, 100, 100, 180, 80, 120].map((w, j) => (
          <td key={j} style={{ padding: '16px 14px' }}>
            <div className="skeleton" style={{ height: 12, width: w, borderRadius: 4 }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/* ── Constants ───────────────────────────────────────────────── */
const STATUS_OPTS = [
  { value: 'all', label: 'All Status' },
  { value: 'created', label: 'Created' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
];

const DATE_OPTS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
];

const PAGE_SIZE = 15;

/* ══════════════════════════════════════════════════════════════ */
/*  ORDERS PAGE                                                   */
/* ══════════════════════════════════════════════════════════════ */
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      const list = Array.isArray(data) ? data : (data?.orders || data?.results || []);
      setOrders(list);
    } catch (err) {
      console.error('Fetch orders failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* ── Filtered result ────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = orders;

    // Status
    if (statusFilter !== 'all') {
      list = list.filter(o => (o.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Search (by ID)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => String(o.id).toLowerCase().includes(q));
    }

    // Date Range
    if (dateRange !== 'all') {
      const now = new Date();
      list = list.filter(o => {
        const created = new Date(o.created_at);
        if (dateRange === 'today') {
          return created.toDateString() === now.toDateString();
        }
        if (dateRange === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return created >= sevenDaysAgo;
        }
        return true;
      });
    }

    return list;
  }, [orders, statusFilter, search, dateRange]);

  /* ── Pagination ────────────────────────────────────── */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filtered.length]);

  /* ── Counts for Stat Pills ─────────────────────────── */
  const counts = useMemo(() => ({
    created: orders.filter(o => (o.status || '').toLowerCase() === 'created').length,
    assigned: orders.filter(o => (o.status || '').toLowerCase() === 'assigned').length,
    in_transit: orders.filter(o => {
      const s = (o.status || '').toLowerCase();
      return s === 'in_transit' || s === 'in_progress';
    }).length,
    delivered: orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length,
  }), [orders]);

  const hasFilters = search || statusFilter !== 'all' || dateRange !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setDateRange('all');
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, height: '100%', overflowY: 'auto' }}>

      {/* ── TOP STATS BAR ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatPill
          label="Created"
          value={counts.created}
          active={statusFilter === 'created'}
          onClick={() => setStatus(statusFilter === 'created' ? 'all' : 'created')}
          color="gray"
        />
        <StatPill
          label="Assigned"
          value={counts.assigned}
          active={statusFilter === 'assigned'}
          onClick={() => setStatus(statusFilter === 'assigned' ? 'all' : 'assigned')}
          color="blue"
        />
        <StatPill
          label="In Transit"
          value={counts.in_transit}
          active={statusFilter === 'in_transit'}
          onClick={() => setStatus(statusFilter === 'in_transit' ? 'all' : 'in_transit')}
          color="purple"
        />
        <StatPill
          label="Delivered"
          value={counts.delivered}
          active={statusFilter === 'delivered'}
          onClick={() => setStatus(statusFilter === 'delivered' ? 'all' : 'delivered')}
          color="green"
        />
      </div>

      {/* ── FILTERS ROW ─────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 13 }} />
          <input
            placeholder="Search by Order ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', height: 40, padding: '0 12px 0 36px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 13, outline: 'none'
            }}
          />
        </div>

        <CustomSelect value={statusFilter} options={STATUS_OPTS} onChange={setStatus} icon={Filter} />
        <CustomSelect value={dateRange} options={DATE_OPTS} onChange={setDateRange} icon={Calendar} />

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              height: 40, padding: '0 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <X size={14} /> Clear
          </button>
        )}

        <button
          onClick={fetchOrders}
          style={{
            height: 40, width: 40, borderRadius: 'var(--radius-sm)', background: 'rgba(108,99,255,0.1)',
            border: '1px solid rgba(108,99,255,0.2)', color: 'var(--primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── ORDERS TABLE ────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                {['Order ID', 'Customer', 'Agent', 'Status Badge', 'Pickup → Drop', 'ETA', 'Created Time'].map(h => (
                  <th key={h} style={{
                    padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '64px 0', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.5 }}>
                      <Package size={48} color="var(--text-muted)" />
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>No orders found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((order, idx) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                    style={{ borderBottom: '1px solid rgba(42,42,58,0.5)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* ID */}
                    <td style={{ padding: '16px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                        {truncId(order.id)}
                      </span>
                    </td>
                    {/* Customer */}
                    <td style={{ padding: '16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={12} color="var(--text-muted)" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{order.customer || `Client_${String(order.id).slice(-4)}`}</span>
                      </div>
                    </td>
                    {/* Agent */}
                    <td style={{ padding: '16px 14px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{order.agent_name || order.agent || '—'}</span>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '16px 14px' }}>
                      <StatusBadge value={order.status} size="xs" />
                    </td>
                    {/* Pickup -> Drop */}
                    <td style={{ padding: '16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{fmtCoord(order.pickup_lat)},{fmtCoord(order.pickup_lng)}</span>
                        <ArrowRight size={11} color="var(--text-faint)" />
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{fmtCoord(order.drop_lat || order.dropoff_lat)},{fmtCoord(order.drop_lng || order.dropoff_lng)}</span>
                      </div>
                    </td>
                    {/* ETA */}
                    <td style={{ padding: '16px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#00D4AA', fontFamily: 'JetBrains Mono, monospace' }}>
                         {order.eta_minutes ? `${order.eta_minutes}m` : '—'}
                      </span>
                    </td>
                    {/* Created */}
                    <td style={{ padding: '16px 14px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(order.created_at)}</span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ─────────────────────────────────── */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages} ({filtered.length} results)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                height: 32, padding: '0 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12, cursor: page === 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, opacity: page === 1 ? 0.3 : 1
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                height: 32, padding: '0 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12, cursor: page === totalPages ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, opacity: page === totalPages ? 0.3 : 1
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Orders;
