# ⚡ ESP32 Power Monitor — Real-Time AC Power & Cost Dashboard

> **Measure AC voltage, current, and power in real-time. Track electricity costs. View on a live web dashboard from anywhere.**

```
ESP32 + ZMPT101B + SCT-013  →  Supabase (PostgreSQL)  →  Vercel (Next.js Dashboard)
        (sensors + firmware)          (backend + realtime)         (frontend + hosting)
```

![Dashboard Preview](https://raw.githubusercontent.com/randomkind2727/esp32-power-monitor/main/docs/preview.png)

## 🎯 Features

- **Live Gauges** — Voltage, Current, Power, Cost Today with animated circular progress rings
- **Electricity Cost Tracker** — Configurable ₹/kWh rate, daily/weekly/monthly cost breakdown
- **Real-Time Charts** — Line chart with metric toggles, bar chart for hourly cost
- **Cost Analytics** — Today vs Yesterday comparison, estimated monthly cost, spending trends
- **Realtime Updates** — Supabase Realtime subscriptions, data updates every 2 seconds
- **Responsive Design** — Dark glassmorphism theme, works on mobile/tablet/desktop
- **Demo Mode** — Works without Supabase for local preview with realistic generated data

## 📁 Project Structure

```
├── firmware/                   # ESP32 Arduino code
│   └── power_monitor/
│       └── power_monitor.ino   # Reads ZMPT101B + SCT-013, sends to Supabase
│
├── dashboard/                  # Next.js 14 frontend (deploy to Vercel)
│   ├── app/
│   │   ├── page.js             # Main dashboard (gauges, charts, cost, table)
│   │   ├── layout.js           # Root layout with metadata
│   │   └── globals.css         # Dark glassmorphism theme
│   ├── lib/
│   │   └── supabase.js         # Supabase client + helper functions
│   ├── package.json            # Dependencies
│   ├── vercel.json             # Vercel deployment config
│   └── .env.example            # Environment variable template
│
├── supabase/                   # Database schema + functions
│   └── schema.sql              # Tables, indexes, RLS policies, views, RPC
│
├── docs/
│   ├── deployment-guide.md     # Step-by-step Supabase + Vercel setup
│   └── wiring-and-calibration.md # Sensor wiring + calibration guide
│
└── README.md                   # This file
```

## 🚀 Quick Deploy to Vercel (One Click)

**Prerequisites:** A Supabase project with the schema deployed.

### Step 1: Set Up Supabase

1. Create a project at [supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql)
3. Go to **Database → Replication** → Enable Realtime on `power_readings`
4. Copy your **Project URL** and **anon key** from Settings → API

### Step 2: Deploy Dashboard

Option A — **Vercel CLI:**
```bash
cd dashboard
npm install
vercel
# Paste your Supabase URL and anon key when prompted
```

Option B — **Vercel Dashboard:**
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → Select this repo
3. Set root directory to `dashboard/`
4. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...your_key_here
   ```
5. Click **Deploy** 🎉

Option C — **Vercel CLI with env:**
```bash
cd dashboard
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```

### Step 3: Configure ESP32

1. Install libraries in Arduino IDE: `ESPSupabase`, `ArduinoJson`
2. Edit credentials in `firmware/power_monitor/power_monitor.ino`:
   - WiFi SSID + password
   - Supabase URL + anon key
3. Wire sensors (see [`docs/wiring-and-calibration.md`](docs/wiring-and-calibration.md))
4. Upload to ESP32 → watch the dashboard come alive! ⚡

## 🛠 Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| **Microcontroller** | ESP32 DevKit V1 | ~$5 one-time |
| **Voltage Sensor** | ZMPT101B (isolated) | ~$4 one-time |
| **Current Sensor** | SCT-013-000 (CT clamp) | ~$4 one-time |
| **Backend** | Supabase (PostgreSQL + Realtime) | Free tier |
| **Frontend** | Next.js 14 + React 18 + Tailwind CSS | Free |
| **Charts** | Chart.js + react-chartjs-2 | Free (MIT) |
| **Hosting** | Vercel | Free tier |
| **Total** | | **~$13 one-time + $0/month** |

## 📊 Dashboard Sections

| Section | What It Shows |
|---------|--------------|
| **Gauge Cards** | Live V/I/P/Cost with circular progress rings + sparklines |
| **Stats Grid** | Avg, Peak, Energy, Cost, Est. Monthly, Readings count |
| **Live Chart** | Multi-line time series with toggles + time range selector |
| **Hourly Cost** | Bar chart of today's spending per hour |
| **Comparison** | Today vs Yesterday doughnut with % change |
| **Cost Summary** | Daily/Weekly/Monthly cards with progress bars |
| **Readings Table** | Last 50 readings with per-row cost calculation |

## ⚙️ Configuration

The dashboard has a settings panel (⚙️ button) for:
- **Electricity Rate** (₹/kWh) — default 8.5
- **Device Name** — displayed in header
- **Standby Threshold** (W) — minimum power to count as active
- **Cost Period** — toggle daily/weekly/monthly views

All settings persist in localStorage.

## 🔧 Local Development

```bash
cd dashboard
npm install
cp .env.example .env.local   # Add your Supabase credentials
npm run dev                  # http://localhost:3000
npm run build                # Production build
```

**Demo Mode:** If Supabase credentials are invalid, the dashboard auto-generates realistic demo data (~230V, ~1.2A, ~280W) that updates every 2 seconds. A 🧪 DEMO badge appears in the header.

## ⚠️ Safety

AC mains voltage is **lethal**. The ZMPT101B provides galvanic isolation, and the SCT-013 is non-invasive (clamp-on). Never work on live circuits. Start with low-voltage testing if you're new to electronics.

## 📖 Documentation

- [`docs/deployment-guide.md`](docs/deployment-guide.md) — Full Supabase + Vercel setup walkthrough
- [`docs/wiring-and-calibration.md`](docs/wiring-and-calibration.md) — Sensor wiring diagram + calibration steps
- [`firmware/power_monitor/power_monitor.ino`](firmware/power_monitor/power_monitor.ino) — ESP32 firmware with comments

## 📄 License

MIT — Use it, modify it, share it.
