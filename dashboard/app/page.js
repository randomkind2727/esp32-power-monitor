'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  supabase, getRecentReadings, subscribeToPowerReadings,
} from '@/lib/supabase';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

/* ══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ══════════════════════════════════════════════════════════════ */

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function formatCurrency(n) { return '₹' + Number(n).toFixed(2); }
function formatWatts(n)   { return Number(n).toFixed(1); }
function formatAmps(n)    { return Number(n).toFixed(3); }
function formatVolts(n)   { return Number(n).toFixed(1); }

/** Calculate energy (kWh) and cost from an array of readings */
function calcEnergyAndCost(readings, ratePerKwh) {
  if (readings.length < 2) return { kwh: 0, cost: 0 };
  let wh = 0;
  for (let i = 1; i < readings.length; i++) {
    const dt = (new Date(readings[i].created_at) - new Date(readings[i - 1].created_at)) / 3600000; // hours
    const avgP = (readings[i].power + readings[i - 1].power) / 2; // trapezoidal
    wh += avgP * dt;
  }
  const kwh = wh / 1000;
  return { kwh, cost: kwh * ratePerKwh };
}

/** Group readings by hour for bar chart */
function groupByHour(readings) {
  const buckets = {};
  for (const r of readings) {
    const h = new Date(r.created_at).getHours();
    if (!buckets[h]) buckets[h] = [];
    buckets[h].push(r);
  }
  return buckets;
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS HOOK (persisted to localStorage)
   ══════════════════════════════════════════════════════════════ */

function useSettings() {
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') return { rate: 8.5, deviceName: 'My Appliance', threshold: 5, costPeriod: 'daily' };
    try {
      const s = localStorage.getItem('pm_settings');
      return s ? JSON.parse(s) : { rate: 8.5, deviceName: 'My Appliance', threshold: 5, costPeriod: 'daily' };
    } catch { return { rate: 8.5, deviceName: 'My Appliance', threshold: 5, costPeriod: 'daily' }; }
  });
  useEffect(() => { localStorage.setItem('pm_settings', JSON.stringify(settings)); }, [settings]);
  return [settings, setSettings];
}

/* ══════════════════════════════════════════════════════════════
   CIRCULAR PROGRESS RING
   ══════════════════════════════════════════════════════════════ */

function ProgressRing({ value, max, color, size = 80, strokeWidth = 6, label, unit }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring__circle">
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke="rgba(55,65,81,0.3)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring__circle" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-sm font-bold font-mono" style={{ color }}>{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span className="text-[9px] text-[var(--text-3)] uppercase">{unit}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MINI SPARKLINE
   ══════════════════════════════════════════════════════════════ */

function MiniSparkline({ data, color, height = 40 }) {
  if (!data || data.length < 2) return <div style={{ height }} className="skeleton" />;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100 / (data.length - 1);
  const points = data.map((v, i) => `${i * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} 100,${height}`}
        fill={`url(#sg-${color.replace('#','')})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   GAUGE CARD
   ══════════════════════════════════════════════════════════════ */

function GaugeCard({ label, value, unit, color, icon, max, sparkData, delay }) {
  const glowClass = color === 'var(--blue)' ? 'glow-blue' :
                    color === 'var(--amber)' ? 'glow-amber' :
                    color === 'var(--emerald)' ? 'glow-emerald' : 'glow-violet';

  return (
    <div className={`glass p-5 md:p-6 animate-fade-in-up ${glowClass}`} style={{ animationDelay: delay }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</span>
        </div>
        <ProgressRing value={value || 0} max={max} color={color} size={56} strokeWidth={4} />
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl md:text-4xl font-bold font-mono number-ticker" style={{ color }}>
          {value !== null ? (unit === 'A' ? formatAmps(value) : unit === '₹' ? formatCurrency(value) : formatWatts(value)) : '—'}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{unit}</span>
      </div>
      <div className="opacity-60">
        <MiniSparkline data={sparkData} color={color} height={32} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STAT CARD
   ══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="glass p-4 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold font-mono" style={{ color: color || 'var(--text-0)' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS MODAL
   ══════════════════════════════════════════════════════════════ */

function SettingsModal({ settings, setSettings, onClose }) {
  const [local, setLocal] = useState(settings);

  const save = () => {
    setSettings(local);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gradient">⚙️ Settings</h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text-0)] text-2xl leading-none">&times;</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>
              💰 Electricity Rate (₹/kWh)
            </label>
            <input type="number" step="0.1" value={local.rate}
              onChange={(e) => setLocal({ ...local, rate: parseFloat(e.target.value) || 0 })} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
              India average: ₹6–10/kWh. Check your electricity bill.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>
              📟 Device Name
            </label>
            <input type="text" value={local.deviceName}
              onChange={(e) => setLocal({ ...local, deviceName: e.target.value })} />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>
              ⚡ Standby Threshold (W)
            </label>
            <input type="number" step="1" value={local.threshold}
              onChange={(e) => setLocal({ ...local, threshold: parseFloat(e.target.value) || 0 })} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
              Readings below this power level are treated as standby/no-load.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>
              📅 Cost View Period
            </label>
            <div className="flex gap-2">
              {['daily', 'weekly', 'monthly'].map((p) => (
                <button key={p} onClick={() => setLocal({ ...local, costPeriod: p })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    local.costPeriod === p
                      ? 'bg-[var(--emerald)] text-white'
                      : 'bg-[var(--bg-1)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-0)]'
                  }`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-[var(--bg-1)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-0)] transition-all">
            Cancel
          </button>
          <button onClick={save}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[var(--emerald)] text-white hover:opacity-90 transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const [settings, setSettings] = useSettings();
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState(null);
  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [clock, setClock] = useState('');
  const [activeChart, setActiveChart] = useState('all');
  const [timeRange, setTimeRange] = useState('1h');
  const [flash, setFlash] = useState(null);
  const [loading, setLoading] = useState(true);

  const readingsRef = useRef([]);
  readingsRef.current = readings;

  // ── Demo data generator (for preview without Supabase) ──
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    // Generate 200 demo readings if Supabase fails
    if (loading && !demoMode) {
      const timer = setTimeout(() => {
        const now = Date.now();
        const demo = [];
        for (let i = 199; i >= 0; i--) {
          const t = new Date(now - i * 2000);
          const baseV = 230 + Math.sin(i * 0.1) * 5;
          const baseI = 1.2 + Math.sin(i * 0.05) * 0.4 + Math.random() * 0.2;
          const baseP = baseV * baseI * (0.85 + Math.random() * 0.1);
          demo.push({
            id: 1000 + i,
            device_id: 'esp32_demo',
            voltage: +(baseV + (Math.random() - 0.5) * 3).toFixed(1),
            current: +(baseI + (Math.random() - 0.5) * 0.1).toFixed(3),
            power: +(baseP + (Math.random() - 0.5) * 20).toFixed(1),
            created_at: t.toISOString(),
          });
        }
        setReadings(demo);
        setLatest(demo[demo.length - 1]);
        setLoading(false);
        setDemoMode(true);
        setConnected(true);

        // Keep generating new readings every 2s
        const iv = setInterval(() => {
          setLatest(prev => {
            const newR = {
              id: Date.now(),
              device_id: 'esp32_demo',
              voltage: +((prev?.voltage || 230) + (Math.random() - 0.5) * 4).toFixed(1),
              current: +((prev?.current || 1.2) + (Math.random() - 0.5) * 0.3).toFixed(3),
              power: +((prev?.power || 280) + (Math.random() - 0.5) * 30).toFixed(1),
              created_at: new Date().toISOString(),
            };
            setReadings(p => [...p, newR].slice(-300));
            setFlash(newR.id);
            setTimeout(() => setFlash(null), 800);
            return newR;
          });
        }, 2000);
        return () => clearInterval(iv);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, demoMode]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })), 1000);
    return () => clearInterval(t);
  }, []);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let channel;
    (async () => {
      const data = await getRecentReadings(200);
      setReadings(data);
      if (data.length) setLatest(data[data.length - 1]);
      setLoading(false);

      channel = subscribeToPowerReadings((row) => {
        setLatest(row);
        setReadings((prev) => {
          const next = [...prev, row];
          return next.length > 300 ? next.slice(-300) : next;
        });
        // Flash effect
        setFlash(row.id);
        setTimeout(() => setFlash(null), 800);
        setConnected(true);
      });
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Connection heartbeat
  useEffect(() => {
    const t = setTimeout(() => setConnected(false), 10000);
    return () => clearTimeout(t);
  }, [latest]);

  // ── Derived data ──
  const MAX_POINTS = timeRange === '5m' ? 50 : timeRange === '30m' ? 100 : timeRange === '1h' ? 200 : timeRange === '6h' ? 300 : 300;

  const chartReadings = useMemo(() => {
    const cutoff = Date.now() - (
      timeRange === '5m' ? 300000 : timeRange === '30m' ? 1800000 :
      timeRange === '1h' ? 3600000 : timeRange === '6h' ? 21600000 : 86400000
    );
    return readings.filter(r => new Date(r.created_at) > cutoff).slice(-MAX_POINTS);
  }, [readings, timeRange]);

  const voltageHistory = useMemo(() => chartReadings.map(r => r.voltage), [chartReadings]);
  const currentHistory = useMemo(() => chartReadings.map(r => r.current), [chartReadings]);
  const powerHistory   = useMemo(() => chartReadings.map(r => r.power), [chartReadings]);

  // Today's data
  const todaysData = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return readings.filter(r => new Date(r.created_at) >= start);
  }, [readings]);

  const todayStats = useMemo(() => calcEnergyAndCost(todaysData, settings.rate), [todaysData, settings.rate]);

  // Yesterday comparison
  const yesterdayStats = useMemo(() => {
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 1);
    const ydata = readings.filter(r => { const t = new Date(r.created_at); return t >= start && t < end; });
    return calcEnergyAndCost(ydata, settings.rate);
  }, [readings, settings.rate]);

  // Weekly / Monthly
  const weeklyStats = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 7);
    const wdata = readings.filter(r => new Date(r.created_at) >= start);
    return calcEnergyAndCost(wdata, settings.rate);
  }, [readings, settings.rate]);

  const monthlyStats = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const mdata = readings.filter(r => new Date(r.created_at) >= start);
    return calcEnergyAndCost(mdata, settings.rate);
  }, [readings, settings.rate]);

  const displayStats = settings.costPeriod === 'daily' ? todayStats
                     : settings.costPeriod === 'weekly' ? weeklyStats
                     : monthlyStats;

  // Hourly cost bar chart data
  const hourlyCostData = useMemo(() => {
    const buckets = {};
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const todayR = readings.filter(r => new Date(r.created_at) >= start);
    for (const r of todayR) {
      const h = new Date(r.created_at).getHours();
      if (!buckets[h]) buckets[h] = [];
      buckets[h].push(r);
    }
    const labels = [];
    const data = [];
    for (let h = 0; h < 24; h++) {
      labels.push(`${h.toString().padStart(2, '0')}:00`);
      if (buckets[h] && buckets[h].length > 1) {
        const { cost } = calcEnergyAndCost(buckets[h], settings.rate);
        data.push(cost);
      } else {
        data.push(0);
      }
    }
    return { labels, data };
  }, [readings, settings.rate]);

  // Stats
  const avgVoltage = useMemo(() => voltageHistory.length ? (voltageHistory.reduce((a, b) => a + b, 0) / voltageHistory.length) : 0, [voltageHistory]);
  const avgCurrent = useMemo(() => currentHistory.length ? (currentHistory.reduce((a, b) => a + b, 0) / currentHistory.length) : 0, [currentHistory]);
  const avgPower   = useMemo(() => powerHistory.length ? (powerHistory.reduce((a, b) => a + b, 0) / powerHistory.length) : 0, [powerHistory]);
  const peakPower  = useMemo(() => powerHistory.length ? Math.max(...powerHistory) : 0, [powerHistory]);
  const peakCurrent= useMemo(() => currentHistory.length ? Math.max(...currentHistory) : 0, [currentHistory]);

  // Estimated monthly cost
  const estimatedMonthly = useMemo(() => {
    if (todaysData.length < 2) return 0;
    const hoursCovered = (new Date(todaysData[todaysData.length - 1].created_at) - new Date(todaysData[0].created_at)) / 3600000;
    if (hoursCovered < 0.1) return 0;
    const avgPwr = todaysData.reduce((s, r) => s + r.power, 0) / todaysData.length;
    return (avgPwr * 24 * 30 / 1000) * settings.rate;
  }, [todaysData, settings.rate]);

  // ── Chart.js data ──
  const mainChartData = useMemo(() => ({
    labels: chartReadings.map(r => formatTime(r.created_at)),
    datasets: [
      {
        label: 'Voltage (V)', data: voltageHistory,
        borderColor: 'var(--blue)', backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        hidden: activeChart !== 'all' && activeChart !== 'voltage',
        yAxisID: 'y',
      },
      {
        label: 'Current (A)', data: currentHistory,
        borderColor: 'var(--amber)', backgroundColor: 'rgba(245,158,11,0.08)',
        borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        hidden: activeChart !== 'all' && activeChart !== 'current',
        yAxisID: 'y1',
      },
      {
        label: 'Power (W)', data: powerHistory,
        borderColor: 'var(--emerald)', backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        hidden: activeChart !== 'all' && activeChart !== 'power',
        yAxisID: 'y2',
      },
    ],
  }), [chartReadings, voltageHistory, currentHistory, powerHistory, activeChart]);

  const mainChartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(12,16,24,0.95)',
        titleColor: 'var(--text-0)', bodyColor: 'var(--text-2)',
        borderColor: 'var(--border)', borderWidth: 1,
        padding: 14, cornerRadius: 12, displayColors: true,
        usePointStyle: true, pointStyle: 'circle',
        callbacks: {
          label: (ctx) => {
            const unit = ctx.datasetIndex === 0 ? 'V' : ctx.datasetIndex === 1 ? 'A' : 'W';
            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ${unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'var(--text-3)', maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } },
        grid: { color: 'rgba(55,65,81,0.2)' },
      },
      y: {
        type: 'linear', position: 'left',
        title: { display: true, text: 'V', color: 'var(--blue)', font: { size: 11, weight: 'bold' } },
        ticks: { color: 'var(--blue)', font: { size: 10 } },
        grid: { color: 'rgba(55,65,81,0.2)' },
        min: 0, suggestedMax: 260,
      },
      y1: {
        type: 'linear', position: 'right',
        title: { display: true, text: 'A', color: 'var(--amber)', font: { size: 11, weight: 'bold' } },
        ticks: { color: 'var(--amber)', font: { size: 10 } },
        grid: { drawOnChartArea: false }, min: 0,
      },
      y2: {
        type: 'linear', position: 'right',
        title: { display: true, text: 'W', color: 'var(--emerald)', font: { size: 11, weight: 'bold' } },
        ticks: { color: 'var(--emerald)', font: { size: 10 } },
        grid: { drawOnChartArea: false }, min: 0,
      },
    },
    animation: { duration: 400 },
  }), [activeChart]);

  // Hourly cost bar chart
  const hourlyChartData = useMemo(() => ({
    labels: hourlyCostData.labels,
    datasets: [{
      label: 'Cost (₹)', data: hourlyCostData.data,
      backgroundColor: hourlyCostData.data.map((v, i) => {
        const h = new Date().getHours();
        return i === h ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.3)';
      }),
      borderColor: 'var(--violet)', borderWidth: 1, borderRadius: 4,
      barPercentage: 0.7,
    }],
  }), [hourlyCostData]);

  const hourlyChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(12,16,24,0.95)',
        titleColor: 'var(--text-0)', bodyColor: 'var(--text-2)',
        borderColor: 'var(--border)', borderWidth: 1,
        padding: 12, cornerRadius: 10,
        callbacks: {
          label: (ctx) => ` Cost: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'var(--text-3)', maxTicksLimit: 12, font: { size: 9 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: 'var(--violet)', font: { size: 10 }, callback: (v) => '₹' + v.toFixed(0) },
        grid: { color: 'rgba(55,65,81,0.2)' }, min: 0,
      },
    },
  };

  // ── Cost comparison doughnut ──
  const costComparisonData = useMemo(() => {
    const todayCost = todayStats.cost;
    const yesterdayCost = yesterdayStats.cost;
    return {
      labels: ['Today', 'Yesterday (same time)'],
      datasets: [{
        data: [todayCost, yesterdayCost || 0.01],
        backgroundColor: ['rgba(139,92,246,0.8)', 'rgba(55,65,81,0.4)'],
        borderColor: ['var(--violet)', 'var(--border)'],
        borderWidth: 2,
        cutout: '70%',
      }],
    };
  }, [todayStats.cost, yesterdayStats.cost]);

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <div className="text-center animate-fade-in">
          <div className="text-5xl mb-4">⚡</div>
          <div className="text-xl font-semibold text-gradient mb-2">Power Monitor</div>
          <div className="skeleton w-48 h-3 mx-auto mb-4" />
          <div className="text-sm" style={{ color: 'var(--text-3)' }}>Connecting to Supabase...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg-0)' }}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 relative z-10">

        {/* ── HEADER ── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gradient-blue tracking-tight">
              ⚡ Power Monitor
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Real-time AC power consumption — ESP32 + ZMPT101B + SCT-013
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>{clock}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{settings.deviceName}</div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              connected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <span className={`status-dot ${connected ? 'active' : 'inactive'}`} />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>
            {demoMode && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                🧪 DEMO
              </span>
            )}
            <button onClick={() => setShowSettings(true)}
              className="glass w-10 h-10 rounded-xl flex items-center justify-center text-lg hover:scale-110 transition-transform"
              style={{ color: 'var(--text-2)' }}>
              ⚙️
            </button>
          </div>
        </header>

        {/* ── GAUGE CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GaugeCard label="Voltage" value={latest?.voltage} unit="V" color="var(--blue)" icon="⚡"
            max={280} sparkData={voltageHistory.slice(-30)} delay="0s" />
          <GaugeCard label="Current" value={latest?.current} unit="A" color="var(--amber)" icon="🔌"
            max={15} sparkData={currentHistory.slice(-30)} delay="0.1s" />
          <GaugeCard label="Power" value={latest?.power} unit="W" color="var(--emerald)" icon="💡"
            max={3000} sparkData={powerHistory.slice(-30)} delay="0.2s" />
          <GaugeCard label="Cost Today" value={todayStats.cost} unit="₹" color="var(--violet)" icon="💰"
            max={Math.max(todayStats.cost * 1.5, 50)} sparkData={hourlyCostData.data.filter(v => v > 0).slice(-12).map((v, i) => v)} delay="0.3s" />
        </div>

        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          <StatCard label="Avg Voltage" value={`${formatVolts(avgVoltage)}V`} icon="📊" color="var(--blue)" />
          <StatCard label="Avg Current" value={`${formatAmps(avgCurrent)}A`} icon="📈" color="var(--amber)" />
          <StatCard label="Peak Power" value={`${formatWatts(peakPower)}W`} icon="🔺" color="var(--emerald)" />
          <StatCard label="Peak Current" value={`${formatAmps(peakCurrent)}A`} icon="⚡" color="var(--amber)" />
          <StatCard label="Energy Today" value={`${todayStats.kwh.toFixed(3)} kWh`} icon="🔋" color="var(--cyan)" />
          <StatCard label="Cost Today" value={formatCurrency(todayStats.cost)} icon="💵" color="var(--violet)" />
          <StatCard label="Est. Monthly" value={formatCurrency(estimatedMonthly)} icon="📅" color="var(--violet)" />
          <StatCard label="Readings" value={readings.length.toLocaleString()} icon="📡" color="var(--text-1)" sub={`Rate: ₹${settings.rate}/kWh`} />
        </div>

        {/* ── MAIN CHART ── */}
        <div className="glass p-5 md:p-6 mb-8 animate-fade-in-up delay-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <h2 className="text-lg font-bold text-gradient">📈 Live Power Chart</h2>
            <div className="flex flex-wrap gap-2">
              {/* Metric toggles */}
              {[
                { key: 'all', label: 'All', color: 'var(--text-1)' },
                { key: 'voltage', label: 'Voltage', color: 'var(--blue)' },
                { key: 'current', label: 'Current', color: 'var(--amber)' },
                { key: 'power', label: 'Power', color: 'var(--emerald)' },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setActiveChart(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeChart === key ? 'border' : 'border border-transparent opacity-50 hover:opacity-80'
                  }`}
                  style={activeChart === key ? { background: `${color}15`, color, borderColor: `${color}40` } : { color }}>
                  {label}
                </button>
              ))}
              <div className="w-px bg-[var(--border)] mx-1" />
              {/* Time range */}
              {['5m', '30m', '1h', '6h', '24h'].map((t) => (
                <button key={t} onClick={() => setTimeRange(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    timeRange === t ? 'bg-[var(--bg-3)] text-[var(--text-0)]' : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] md:h-[400px]">
            {chartReadings.length > 1 ? (
              <Line data={mainChartData} options={mainChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p style={{ color: 'var(--text-3)' }}>Waiting for data from ESP32...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── COST ANALYTICS ROW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">

          {/* Hourly Cost Bar Chart */}
          <div className="lg:col-span-2 glass p-5 md:p-6 animate-fade-in-up delay-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gradient-violet">💰 Today's Hourly Cost</h2>
              <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}>
                Total: {formatCurrency(todayStats.cost)}
              </span>
            </div>
            <div className="h-[220px]">
              <Bar data={hourlyChartData} options={hourlyChartOptions} />
            </div>
          </div>

          {/* Cost Comparison Doughnut */}
          <div className="glass p-5 md:p-6 animate-fade-in-up delay-400">
            <h2 className="text-lg font-bold text-gradient-violet mb-4">📊 Today vs Yesterday</h2>
            <div className="h-[160px] flex items-center justify-center">
              <Doughnut data={costComparisonData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { color: 'var(--text-2)', usePointStyle: true, padding: 12, font: { size: 11 } } },
                  tooltip: {
                    backgroundColor: 'rgba(12,16,24,0.95)', padding: 12, cornerRadius: 10,
                    callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed)}` },
                  },
                },
              }} />
            </div>
            <div className="text-center mt-2">
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {todayStats.cost > yesterdayStats.cost ? '📈' : '📉'}
                {' '}{Math.abs(((todayStats.cost - (yesterdayStats.cost || 0)) / Math.max(yesterdayStats.cost, 0.01)) * 100).toFixed(0)}% vs yesterday
              </span>
            </div>
          </div>
        </div>

        {/* ── COST SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Today's Cost", cost: todayStats.cost, kwh: todayStats.kwh, icon: '🌅', color: 'var(--blue)', bg: 'var(--blue-dim)' },
            { label: "This Week", cost: weeklyStats.cost, kwh: weeklyStats.kwh, icon: '📅', color: 'var(--emerald)', bg: 'var(--emerald-dim)' },
            { label: "This Month", cost: monthlyStats.cost, kwh: monthlyStats.kwh, icon: '🗓️', color: 'var(--violet)', bg: 'var(--violet-dim)' },
          ].map(({ label, cost, kwh, icon, color, bg }) => (
            <div key={label} className="glass p-5 animate-fade-in-up" style={{ borderColor: `${color}30` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{label}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-black font-mono" style={{ color }}>{formatCurrency(cost)}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                {kwh.toFixed(3)} kWh @ ₹{settings.rate}/kWh
              </div>
              <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-1)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((cost / Math.max(estimatedMonthly / 30 * (label === 'Today' ? 1 : label === 'This Week' ? 7 : 30), 1)) * 100, 100)}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── RECENT READINGS TABLE ── */}
        <div className="glass p-5 md:p-6 mb-8 animate-fade-in-up delay-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gradient">📋 Recent Readings</h2>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Last 50 readings</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                <tr style={{ color: 'var(--text-3)' }}>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Time</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Voltage</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Current</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Power</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(-50).reverse().map((r, i) => {
                  const readingCost = (r.power / 1000) * (2 / 3600) * settings.rate; // approximate per-reading cost
                  return (
                    <tr key={r.id}
                      className={`border-b transition-colors ${flash === r.id ? 'animate-flash' : ''}`}
                      style={{ borderColor: 'rgba(55,65,81,0.2)' }}>
                      <td className="py-2.5 px-4 font-mono text-xs" style={{ color: 'var(--text-2)' }}>
                        {formatTime(r.created_at)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: 'var(--blue)' }}>
                        {formatVolts(r.voltage)} V
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: 'var(--amber)' }}>
                        {formatAmps(r.current)} A
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium" style={{ color: 'var(--emerald)' }}>
                        {formatWatts(r.power)} W
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs" style={{ color: 'var(--violet)' }}>
                        {formatCurrency(readingCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="text-center py-6 animate-fade-in">
          <div className="text-xs" style={{ color: 'var(--text-3)' }}>
            ⚡ Power Monitor — ESP32 + ZMPT101B + SCT-013 + Supabase + Next.js + Vercel
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--bg-3)' }}>
            Last updated: {latest ? formatTime(latest.created_at) : '—'}
          </div>
        </footer>
      </div>

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
