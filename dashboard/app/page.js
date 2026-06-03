'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { supabase, getRecentReadings, subscribeToPowerReadings } from '@/lib/supabase';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ── Constants ──
const MAX_DATA_POINTS = 200;  // Max points on the live chart
const CHART_COLORS = {
  voltage: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  current: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
  power:   { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
};

// ── Main Dashboard Component ──
export default function Dashboard() {
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeChart, setActiveChart] = useState('all'); // 'all' | 'voltage' | 'current' | 'power'

  // Fetch initial data
  useEffect(() => {
    async function loadInitial() {
      const data = await getRecentReadings(MAX_DATA_POINTS);
      setReadings(data);
      if (data.length > 0) {
        setLatest(data[data.length - 1]);
      }
    }
    loadInitial();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    setIsConnected(true);

    const channel = subscribeToPowerReadings((newReading) => {
      setLatest(newReading);
      setReadings((prev) => {
        const updated = [...prev, newReading];
        // Keep only the last MAX_DATA_POINTS
        if (updated.length > MAX_DATA_POINTS) {
          return updated.slice(-MAX_DATA_POINTS);
        }
        return updated;
      });
    });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, []);

  // Format time for chart labels
  const formatTime = useCallback((dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  // ── Chart Data ──
  const chartData = {
    labels: readings.map((r) => formatTime(r.created_at)),
    datasets: [
      {
        label: 'Voltage (V)',
        data: readings.map((r) => r.voltage),
        borderColor: CHART_COLORS.voltage.border,
        backgroundColor: CHART_COLORS.voltage.bg,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        hidden: activeChart !== 'all' && activeChart !== 'voltage',
        yAxisID: 'y',
      },
      {
        label: 'Current (A)',
        data: readings.map((r) => r.current),
        borderColor: CHART_COLORS.current.border,
        backgroundColor: CHART_COLORS.current.bg,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        hidden: activeChart !== 'all' && activeChart !== 'current',
        yAxisID: 'y1',
      },
      {
        label: 'Power (W)',
        data: readings.map((r) => r.power),
        borderColor: CHART_COLORS.power.border,
        backgroundColor: CHART_COLORS.power.bg,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        hidden: activeChart !== 'all' && activeChart !== 'power',
        yAxisID: 'y2',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#a1a1aa',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleColor: '#e4e4e7',
        bodyColor: '#a1a1aa',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#71717a',
          maxTicksLimit: 10,
          maxRotation: 0,
        },
        grid: {
          color: 'rgba(39, 39, 42, 0.5)',
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Voltage (V)',
          color: CHART_COLORS.voltage.border,
        },
        ticks: { color: CHART_COLORS.voltage.border },
        grid: { color: 'rgba(39, 39, 42, 0.5)' },
        min: 0,
        suggestedMax: 250,
      },
      y1: {
        type: 'linear',
        display: activeChart === 'all' || activeChart === 'current',
        position: 'right',
        title: {
          display: true,
          text: 'Current (A)',
          color: CHART_COLORS.current.border,
        },
        ticks: { color: CHART_COLORS.current.border },
        grid: { drawOnChartArea: false },
        min: 0,
      },
      y2: {
        type: 'linear',
        display: activeChart === 'all' || activeChart === 'power',
        position: 'right',
        title: {
          display: true,
          text: 'Power (W)',
          color: CHART_COLORS.power.border,
        },
        ticks: { color: CHART_COLORS.power.border },
        grid: { drawOnChartArea: false },
        min: 0,
      },
    },
    animation: {
      duration: 300,
    },
  };

  // ── Stats ──
  const stats = {
    maxVoltage: readings.length ? Math.max(...readings.map((r) => r.voltage)).toFixed(1) : '0',
    maxCurrent: readings.length ? Math.max(...readings.map((r) => r.current)).toFixed(3) : '0',
    maxPower: readings.length ? Math.max(...readings.map((r) => r.power)).toFixed(1) : '0',
    avgPower: readings.length
      ? (readings.reduce((s, r) => s + r.power, 0) / readings.length).toFixed(1)
      : '0',
    totalReadings: readings.length,
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            ⚡ Power Monitor
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1">
            Real-time AC power consumption — ESP32 + ZMPT101B + SCT-013
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isConnected
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
          <div className="text-xs text-[#71717a]">
            {stats.totalReadings} readings
          </div>
        </div>
      </header>

      {/* Live Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <GaugeCard
          label="Voltage"
          value={latest?.voltage?.toFixed(1) ?? '—'}
          unit="V"
          color="blue"
          icon="⚡"
        />
        <GaugeCard
          label="Current"
          value={latest?.current?.toFixed(3) ?? '—'}
          unit="A"
          color="yellow"
          icon="🔌"
        />
        <GaugeCard
          label="Power"
          value={latest?.power?.toFixed(1) ?? '—'}
          unit="W"
          color="green"
          icon="💡"
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatCard label="Max Voltage" value={`${stats.maxVoltage} V`} />
        <StatCard label="Max Current" value={`${stats.maxCurrent} A`} />
        <StatCard label="Max Power" value={`${stats.maxPower} W`} />
        <StatCard label="Avg Power" value={`${stats.avgPower} W`} />
        <StatCard label="Device" value={latest?.device_id ?? '—'} />
      </div>

      {/* Chart */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-[#27272a] p-4 md:p-6">
        {/* Chart Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-[#e4e4e7]">Live Chart</h2>
          <div className="flex gap-2">
            {(['all', 'voltage', 'current', 'power'] as const).map((chart) => (
              <button
                key={chart}
                onClick={() => setActiveChart(chart)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeChart === chart
                    ? 'bg-[#27272a] text-[#e4e4e7] border border-[#3f3f46]'
                    : 'text-[#71717a] hover:text-[#a1a1aa] border border-transparent'
                }`}
              >
                {chart === 'all' ? 'All' : chart.charAt(0).toUpperCase() + chart.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-[350px] md:h-[450px]">
          {readings.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-[#71717a]">
              <div className="text-center">
                <div className="text-4xl mb-3">📊</div>
                <p>Waiting for data from ESP32...</p>
                <p className="text-sm mt-1">Make sure your device is powered on and connected to WiFi</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Readings Table */}
      <div className="mt-8 bg-[#1a1a2e] rounded-2xl border border-[#27272a] p-4 md:p-6">
        <h2 className="text-lg font-semibold text-[#e4e4e7] mb-4">Recent Readings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#71717a] border-b border-[#27272a]">
                <th className="text-left py-3 px-4 font-medium">Time</th>
                <th className="text-right py-3 px-4 font-medium">Voltage (V)</th>
                <th className="text-right py-3 px-4 font-medium">Current (A)</th>
                <th className="text-right py-3 px-4 font-medium">Power (W)</th>
                <th className="text-right py-3 px-4 font-medium">Device</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(-20).reverse().map((reading, i) => (
                <tr
                  key={reading.id}
                  className={`border-b border-[#27272a]/50 ${
                    i === 0 ? 'bg-green-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-4 text-[#a1a1aa]">
                    {new Date(reading.created_at).toLocaleTimeString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-right text-blue-400 font-mono">
                    {reading.voltage?.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-yellow-400 font-mono">
                    {reading.current?.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-green-400 font-mono">
                    {reading.power?.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#71717a] font-mono text-xs">
                    {reading.device_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-[#52525b]">
        ESP32 Power Monitor — Built with Next.js + Supabase + Chart.js + Vercel
      </footer>
    </main>
  );
}

// ── Gauge Card Component ──
function GaugeCard({ label, value, unit, color, icon }) {
  const colorMap = {
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      glow: 'shadow-blue-500/20',
    },
    yellow: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      glow: 'shadow-yellow-500/20',
    },
    green: {
      text: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      glow: 'shadow-green-500/20',
    },
  };

  const c = colorMap[color] || colorMap.green;

  return (
    <div className={`${c.bg} ${c.border} border rounded-2xl p-6 transition-all hover:scale-[1.02] shadow-lg ${c.glow}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-[#71717a] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl font-bold font-mono ${c.text}`}>
          {value}
        </span>
        <span className={`text-lg ${c.text} opacity-60`}>{unit}</span>
      </div>
    </div>
  );
}

// ── Stat Card Component ──
function StatCard({ label, value }) {
  return (
    <div className="bg-[#12121a] border border-[#27272a] rounded-xl p-4">
      <div className="text-xs text-[#71717a] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#e4e4e7] font-mono">{value}</div>
    </div>
  );
}
