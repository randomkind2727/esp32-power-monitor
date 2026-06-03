# ⚡ ESP32 Power Monitor — Real-Time AC Power Dashboard

**Measure AC voltage, current, and power in real-time. View on a live web dashboard from anywhere.**

```
ESP32 + ZMPT101B + SCT-013  →  Supabase  →  Vercel Dashboard
     (sensors)                  (backend)      (frontend)
```

## What It Does

- **Measures** AC voltage (V), current (A), and power (W) of any electrical device
- **Sends** data to Supabase every 2 seconds via Wi-Fi
- **Displays** live gauges, charts, and a readings table on a hosted website
- **Updates in real-time** using Supabase Realtime subscriptions
- **Accessible from anywhere** — not just your local network

## Project Structure

```
power-monitor-project/
├── firmware/
│   └── power_monitor/
│       └── power_monitor.ino    # ESP32 Arduino code
├── dashboard/
│   ├── app/
│   │   ├── layout.js            # Next.js layout
│   │   ├── page.js              # Main dashboard page
│   │   └── globals.css          # Tailwind + custom styles
│   ├── lib/
│   │   └── supabase.js          # Supabase client + helpers
│   ├── package.json             # Dependencies
│   ├── next.config.js           # Next.js config
│   ├── tailwind.config.js       # Tailwind config
│   ├── postcss.config.js        # PostCSS config
│   ├── jsconfig.json            # Path aliases
│   └── .env.example             # Environment variable template
├── supabase/
│   └── schema.sql               # Database schema + RLS policies
├── docs/
│   ├── wiring-and-calibration.md  # Wiring diagram + calibration
│   └── deployment-guide.md        # Step-by-step deployment
└── README.md                    # This file
```

## Quick Start

### 1. Hardware (~$13)
- ESP32 DevKit V1 (~$5)
- ZMPT101B voltage sensor (~$4)
- SCT-013-000 current transformer (~$4)
- 33Ω resistor, 2× 10kΩ resistors, 10µF capacitor

### 2. Supabase Setup (5 min)
1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in SQL Editor
3. Enable Realtime on `power_readings` table
4. Copy your Project URL and anon key

### 3. ESP32 Setup (10 min)
1. Install libraries: `ESPSupabase`, `ArduinoJson`
2. Edit WiFi + Supabase credentials in `power_monitor.ino`
3. Wire sensors (see `docs/wiring-and-calibration.md`)
4. Upload to ESP32

### 4. Dashboard Deploy (5 min)
1. Push `dashboard/` to GitHub
2. Import into [vercel.com](https://vercel.com)
3. Add environment variables
4. Deploy — done! 🎉

**Full deployment guide:** `docs/deployment-guide.md`

## Dashboard Features

- **Live gauges** — Voltage, Current, Power with color-coded cards
- **Real-time line chart** — Toggle between V/I/P or view all
- **Stats row** — Max values, average power, reading count
- **Recent readings table** — Last 20 readings with timestamps
- **Connection status** — Live/disconnected indicator
- **Dark theme** — Easy on the eyes
- **Responsive** — Works on mobile, tablet, and desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Microcontroller** | ESP32 (Arduino framework) |
| **Voltage Sensor** | ZMPT101B (isolated AC voltage transformer) |
| **Current Sensor** | SCT-013-000 (non-invasive CT clamp) |
| **Backend** | Supabase (PostgreSQL + REST API + Realtime) |
| **Frontend** | Next.js 14 + React 18 + Tailwind CSS |
| **Charts** | Chart.js + react-chartjs-2 |
| **Hosting** | Vercel (free tier) |

## Cost

**$0/month** — Everything runs on free tiers:
- Supabase free: 500DB, 2GB bandwidth
- Vercel free: 100GB bandwidth
- Hardware: ~$13 one-time

## Safety

⚠️ **AC mains voltage is lethal.** 
- ZMPT101B provides galvanic isolation
- SCT-013 is non-invasive (clamp-on)
- Never work on live circuits
- Start with low-voltage testing if you're new to electronics

## License

MIT — Use it, modify it, share it.
