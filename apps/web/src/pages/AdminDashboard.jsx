import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  Package, FileText, ShoppingBag, Users,
  TrendingUp, TrendingDown, DollarSign,
  ArrowUpRight, RefreshCw, ShoppingCart,
  Activity, WifiOff, Clock, Zap, BarChart2,
  CheckCircle2, Truck, Timer, XCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import AdminSidebar from '@/components/AdminSidebar.jsx';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtRupiah = (n = 0) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);

const fmtCompact = (n = 0) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
};

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ─── Field extractors ─────────────────────────────────────────────────────────

// Nama pembeli: dari usersMap (inject saat fetch), atau fallback expand
const getBuyerName = (o, usersMap = {}) => {
  const u = usersMap[o.user_id];
  if (u?.nama_lengkap) return u.nama_lengkap;
  if (u?.name)         return u.name;
  return o.nama_pembeli || o.buyer_name || o.nama ||
    o.expand?.user?.nama_lengkap || o.expand?.user?.name ||
    o.expand?.buyer?.nama_lengkap || 'Pelanggan';
};

// Nomor / ID pesanan
const getOrderNumber = (o) => o.nomor_pesanan || `#${o.id.slice(-6).toUpperCase()}`;

// Produk dari items array (JSON field) atau fallback
const getProductName = (o) => {
  if (Array.isArray(o.items) && o.items.length > 0) {
    const first = o.items[0];
    return first?.nama || first?.name || first?.product_name || '—';
  }
  return o.nama_produk || o.product_name ||
    o.expand?.produk?.nama || o.expand?.product?.nama || '—';
};

// ─── Status normalizer ────────────────────────────────────────────────────────
// Menggunakan status_pesanan sebagai sumber utama (delivered, shipped, processing, pending, cancelled)

const STATUS_MAP = {
  selesai:    ['selesai','completed','done','sukses','success','delivered'],
  dikirim:    ['dikirim','shipped','on_delivery','on delivery','delivery'],
  diproses:   ['diproses','processing','pending','menunggu','waiting','new'],
  dibatalkan: ['dibatalkan','cancelled','canceled','batal','failed'],
};

const resolveStatus = (o) => {
  // Prioritaskan status_pesanan, fallback ke status
  const raw = (o?.status_pesanan || o?.status || '').toLowerCase().trim();
  for (const [group, aliases] of Object.entries(STATUS_MAP)) {
    if (aliases.includes(raw)) return group;
  }
  return 'menunggu';
};

// Helper untuk string langsung (backward compat)
const resolveStatusStr = (raw = '') => {
  const key = raw.toLowerCase().trim();
  for (const [group, aliases] of Object.entries(STATUS_MAP)) {
    if (aliases.includes(key)) return group;
  }
  return 'menunggu';
};

// ─── Data builders ────────────────────────────────────────────────────────────

const buildChartData = (orderList) => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const mIdx = d.getMonth();
    const yr   = d.getFullYear();
    const mo   = orderList.filter(o => {
      const c = new Date(o.created);
      return c.getMonth() === mIdx && c.getFullYear() === yr;
    });
    // Pemasukan: semua pesanan yg lunas (status_pembayaran = success)
    const pem = mo
      .filter(o => (o.status_pembayaran || '').toLowerCase() === 'success')
      .reduce((s, o) => s + (o.total_harga || 0), 0);
    const pen = mo.reduce((s, o) => s + (o.biaya_produksi || o.hpp || o.cost || 0), 0);
    return { bulan: MONTHS[mIdx], Pemasukan: pem, Pengeluaran: pen, 'Net Profit': pem - pen };
  });
};

const computeStats = ({ prodTotal, blogTotal, orderList, userTotal }) => {
  // Revenue = semua total_harga
  const revenue = orderList.reduce((s, o) => s + (o.total_harga || 0), 0);
  // Pemasukan = yang sudah bayar (success)
  const pemasukan = orderList
    .filter(o => (o.status_pembayaran || '').toLowerCase() === 'success')
    .reduce((s, o) => s + (o.total_harga || 0), 0);
  const pengeluaran = orderList.reduce((s, o) => s + (o.biaya_produksi || o.hpp || o.cost || 0), 0);
  const netProfit   = pemasukan - pengeluaran;
  // byStatus berdasarkan status_pesanan
  const byStatus = {};
  orderList.forEach(o => {
    const k = resolveStatus(o);
    byStatus[k] = (byStatus[k] || 0) + 1;
  });
  return { products: prodTotal, blogs: blogTotal, orders: orderList.length, users: userTotal, revenue, pemasukan, pengeluaran, netProfit, byStatus };
};

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl ${className}`} />
);

const StatusBadge = ({ order, status }) => {
  // Terima order object atau string langsung
  const k = order ? resolveStatus(order) : resolveStatusStr(status || '');
  const config = {
    selesai:    { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800', icon: CheckCircle2,  label: 'Selesai' },
    dikirim:    { cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800',           icon: Truck,         label: 'Dikirim' },
    diproses:   { cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800', icon: Timer,         label: 'Diproses' },
    dibatalkan: { cls: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800',           icon: XCircle,       label: 'Dibatalkan' },
    menunggu:   { cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700',       icon: Timer,         label: 'Menunggu' },
  };
  const { cls, icon: Icon, label } = config[k] || config.menunggu;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-4 text-xs min-w-[190px]">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6 py-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 dark:text-gray-400">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-200">{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, gradient, link, delta, deltaLabel, loading, suffix = '' }) => {
  const isPos = delta >= 0;
  if (loading) return <Skeleton className="h-[120px]" />;
  return (
    <Link to={link} className="group relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-xl hover:shadow-gray-100/60 dark:hover:shadow-black/40 hover:-translate-y-1 transition-all duration-300">
      {/* Accent glow */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07] blur-2xl ${gradient}`} />
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${isPos ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400'}`}>
            {isPos ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          {value}{suffix && <span className="text-base font-semibold text-gray-400 ml-1">{suffix}</span>}
        </p>
        {deltaLabel && <p className="text-[11px] text-gray-400 mt-0.5">{deltaLabel}</p>}
      </div>
    </Link>
  );
};

// ─── Mini KPI strip ───────────────────────────────────────────────────────────

const KpiStrip = ({ label, amount, sub, icon: Icon, color, loading }) => {
  if (loading) return <Skeleton className="h-[88px]" />;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums truncate">{fmtRupiah(amount)}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
};

// ─── Order row ────────────────────────────────────────────────────────────────

const OrderRow = ({ order, isNew, usersMap = {} }) => {
  const buyer    = getBuyerName(order, usersMap);
  const prod     = getProductName(order);
  const orderNum = getOrderNumber(order);
  const initials = buyer.charAt(0).toUpperCase();
  return (
    <tr className={`transition-all duration-500 ${isNew ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/20'}`}>
      <td className="px-5 py-4">
        <span className="font-mono text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg">
          {orderNum}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px] text-sm">{buyer}</span>
        </div>
      </td>
      <td className="px-5 py-4 hidden sm:table-cell">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px] block">{prod}</span>
      </td>
      <td className="px-5 py-4 hidden md:table-cell">
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(order.created).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <span className="font-bold text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap text-sm">
          {fmtRupiah(order.total_harga || 0)}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <StatusBadge order={order} />
      </td>
    </tr>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const { currentUser } = useAuth();

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [isRealtime, setIsRealtime]     = useState(false);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [stats, setStats]               = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [chartData, setChartData]       = useState([]);
  const [newOrderIds, setNewOrderIds]   = useState(new Set());
  const [liveEvents, setLiveEvents]     = useState(0);
  const [usersMap, setUsersMap]         = useState({});

  const metaRef = useRef({ prodTotal: 0, blogTotal: 0, userTotal: 0 });

  const applyOrderList = useCallback((orderList, flashId = null) => {
    const { prodTotal, blogTotal, userTotal } = metaRef.current;
    setStats(computeStats({ prodTotal, blogTotal, orderList, userTotal }));
    setRecentOrders(orderList.slice(0, 8));
    setChartData(buildChartData(orderList));
    setLastUpdated(new Date());
    if (flashId) {
      setLiveEvents(n => n + 1);
      setNewOrderIds(prev => new Set([...prev, flashId]));
      setTimeout(() => setNewOrderIds(prev => { const n = new Set(prev); n.delete(flashId); return n; }), 3000);
    }
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [prodList, blogList, orderList, userList, allUsers] = await Promise.all([
        pb.collection('products').getList(1, 1, { filter: 'is_deleted = false || is_deleted = null', $autoCancel: false }),
        pb.collection('blog').getList(1, 1,     { filter: 'is_deleted = false || is_deleted = null', $autoCancel: false }),
        pb.collection('orders').getFullList({ sort: '-created', $autoCancel: false }),
        pb.collection('users').getList(1, 1, { $autoCancel: false }),
        pb.collection('users').getFullList({ $autoCancel: false }),
      ]);
      // Build usersMap: id → user record
      const map = {};
      allUsers.forEach(u => { map[u.id] = u; });
      setUsersMap(map);
      metaRef.current = { prodTotal: prodList.totalItems, blogTotal: blogList.totalItems, userTotal: userList.totalItems };
      applyOrderList(orderList);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyOrderList]);

  useEffect(() => {
    fetchAll();
    let snapshot = [];

    const subscribe = async () => {
      try {
        const initial = await pb.collection('orders').getFullList({ sort: '-created', $autoCancel: false });
        snapshot = initial;
        await pb.collection('orders').subscribe('*', (e) => {
          if (e.action === 'create') {
            snapshot = [e.record, ...snapshot];
            applyOrderList(snapshot, e.record.id);
          } else if (e.action === 'update') {
            snapshot = snapshot.map(o => o.id === e.record.id ? { ...o, ...e.record } : o);
            applyOrderList(snapshot);
          } else if (e.action === 'delete') {
            snapshot = snapshot.filter(o => o.id !== e.record.id);
            applyOrderList(snapshot);
          }
          setIsRealtime(true);
        });
        setIsRealtime(true);
      } catch (err) {
        console.warn('Realtime unavailable, polling fallback:', err);
        setIsRealtime(false);
      }
    };

    subscribe();
    return () => { pb.collection('orders').unsubscribe('*').catch(() => {}); };
  }, [fetchAll, applyOrderList]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const marginPct = stats?.pemasukan ? Math.round((stats.netProfit / stats.pemasukan) * 100) : 0;

  const statCards = [
    { title: 'Total Produk',  value: stats?.products ?? '—', icon: Package,     gradient: 'from-teal-400 to-emerald-500',   link: '/admin/products', delta: 20, deltaLabel: 'bulan ini' },
    { title: 'Artikel Blog',  value: stats?.blogs ?? '—',    icon: FileText,    gradient: 'from-pink-400 to-rose-500',      link: '/admin/blog',     delta: 18, deltaLabel: 'bulan ini' },
    { title: 'Total Pesanan', value: stats?.orders ?? '—',   icon: ShoppingBag, gradient: 'from-blue-400 to-indigo-500',    link: '/admin/orders',   delta: 33, deltaLabel: 'minggu ini' },
    { title: 'Pengguna',      value: stats?.users ?? '—',    icon: Users,       gradient: 'from-violet-400 to-purple-500',  link: '/admin/users',    delta: 20, deltaLabel: 'minggu ini' },
  ];

  const statusDonut = [
    { key: 'selesai',    label: 'Selesai',    color: '#10b981', icon: CheckCircle2 },
    { key: 'dikirim',    label: 'Dikirim',    color: '#38bdf8', icon: Truck },
    { key: 'diproses',   label: 'Diproses',   color: '#f59e0b', icon: Timer },
    { key: 'dibatalkan', label: 'Dibatalkan', color: '#f43f5e', icon: XCircle },
  ];

  return (
    <>
      <Helmet><title>Dashboard Admin | Vityuu</title></Helmet>

      <div className="min-h-screen flex flex-col bg-[#f8f9fb] dark:bg-gray-950">
        <Header />

        <div className="flex flex-grow max-w-[1440px] mx-auto w-full">
          <AdminSidebar />

          <main className="flex-grow p-5 md:p-8 overflow-x-hidden min-w-0 space-y-5">

            {/* ── Top bar ───────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{today}</p>
                <h1 className="text-[1.6rem] font-bold text-gray-900 dark:text-white leading-tight">
                  {getGreeting()},{' '}
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                    {currentUser?.nama_lengkap?.split(' ')[0] ?? 'Admin'}!
                  </span>
                </h1>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Berikut ringkasan aktivitas toko Vityuu.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Live indicator */}
                <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isRealtime
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                }`}>
                  {isRealtime ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Live · {liveEvents} event{liveEvents !== 1 ? 's' : ''}
                    </>
                  ) : (
                    <><WifiOff className="w-3 h-3" /> Offline</>
                  )}
                </div>

                {/* Last updated */}
                {lastUpdated && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2 rounded-xl">
                    <Clock className="w-3 h-3" />
                    {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}

                {/* Refresh */}
                <button
                  onClick={() => fetchAll(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* ── Stat cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {statCards.map((s, i) => <StatCard key={i} {...s} loading={loading} />)}
            </div>

            {/* ── Financial KPI strip ───────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <KpiStrip
                label="Total Pemasukan"
                amount={stats?.pemasukan ?? 0}
                sub="Pesanan selesai & dikirim"
                icon={TrendingUp}
                color="bg-gradient-to-br from-emerald-400 to-teal-500"
                loading={loading}
              />
              <KpiStrip
                label="Total Pengeluaran"
                amount={stats?.pengeluaran ?? 0}
                sub="HPP & biaya operasional"
                icon={TrendingDown}
                color="bg-gradient-to-br from-rose-400 to-red-500"
                loading={loading}
              />
              <KpiStrip
                label={`Net Profit · Margin ${marginPct}%`}
                amount={stats?.netProfit ?? 0}
                sub="Bulan ini"
                icon={DollarSign}
                color="bg-gradient-to-br from-violet-400 to-purple-500"
                loading={loading}
              />
            </div>

            {/* ── Chart + Status ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Area Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      Tren Keuangan
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">6 bulan terakhir · diperbarui realtime</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    {[['#10b981','Pemasukan'],['#f43f5e','Pengeluaran'],['#8b5cf6','Net Profit']].map(([c,l]) => (
                      <span key={l} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-end gap-2 h-[240px]">
                    {[55,75,45,90,65,100].map((h, i) => (
                      <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t-lg animate-pulse" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        {[['gPem','#10b981'],['gProfit','#8b5cf6']].map(([id,c]) => (
                          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={c} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={c} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={68} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Pemasukan"   stroke="#10b981" strokeWidth={2.5} fill="url(#gPem)"    dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981' }} />
                      <Area type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={2}   fill="none"           dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#f43f5e' }} />
                      <Area type="monotone" dataKey="Net Profit"  stroke="#8b5cf6" strokeWidth={2}   fill="url(#gProfit)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#8b5cf6' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status panel */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-500" />
                      Status Pesanan
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Semua waktu · realtime</p>
                  </div>
                </div>

                {/* Bar mini chart */}
                {!loading && stats && (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={statusDonut.map(s => ({ name: s.label, value: stats.byStatus?.[s.key] ?? 0, color: s.color }))} barSize={22} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Bar dataKey="value" radius={[6,6,0,0]}>
                          {statusDonut.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {loading && <Skeleton className="h-[90px] mb-4" />}

                {/* Status rows */}
                <div className="space-y-3 flex-1">
                  {statusDonut.map((item) => {
                    const count = stats?.byStatus?.[item.key] ?? 0;
                    const pct   = (stats?.orders ?? 0) > 0 ? Math.round((count / stats.orders) * 100) : 0;
                    const Icon  = item.icon;
                    return (
                      <div key={item.key} className="flex items-center gap-3">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.color }} />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600 dark:text-gray-300">{item.label}</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: item.color }}>
                              {loading ? '—' : count}
                              <span className="text-gray-400 font-normal ml-1">{!loading && `(${pct}%)`}</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: loading ? '0%' : `${pct}%`, background: item.color }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer totals */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Total Pesanan</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{loading ? '—' : stats?.orders ?? 0}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Revenue</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{loading ? '—' : fmtCompact(stats?.revenue ?? 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Recent Orders table ───────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50/80 to-white dark:from-gray-900 dark:to-gray-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
                    <ShoppingCart className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-white">Pesanan Terbaru</h2>
                    <p className="text-[11px] text-gray-400">8 pesanan terakhir · otomatis diperbarui realtime</p>
                  </div>
                </div>
                <Link
                  to="/admin/orders"
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                >
                  Lihat semua <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Belum ada pesanan</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600">Pesanan baru akan muncul di sini secara otomatis</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                        {['ID Pesanan','Pelanggan','Produk','Tanggal','Total','Status'].map((h, i) => (
                          <th key={h} className={`text-left px-5 py-3.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ${i === 2 ? 'hidden sm:table-cell' : ''} ${i === 3 ? 'hidden md:table-cell' : ''} ${i >= 4 ? 'text-right' : ''}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
                      {recentOrders.map((order) => (
                        <OrderRow key={order.id} order={order} isNew={newOrderIds.has(order.id)} usersMap={usersMap} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Live event footer */}
              {isRealtime && liveEvents > 0 && (
                <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <Zap className="w-3 h-3" />
                  {liveEvents} pembaruan realtime diterima sejak halaman dimuat
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
