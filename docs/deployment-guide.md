# 🚀 Deployment Guide — Supabase + Vercel

## Step 1: Set Up Supabase

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → Sign up / Log in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `power-monitor`
   - **Database Password:** (save this somewhere safe)
   - **Region:** Pick the closest to you
4. Click **"Create New Project"** — wait ~2 minutes

### 1.2 Get Your API Credentials
1. Go to **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** → `https://YOUR_PROJECT_ID.supabase.co`
   - **anon/public key** → starts with `eyJ...`

### 1.3 Create the Database Schema
1. Go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Paste the entire contents of `/supabase/schema.sql`
4. Click **"Run"** ✅

### 1.4 Enable Realtime
1. Go to **Database** → **Replication** (under Database section)
2. Find `power_readings` in the list
3. Toggle **"Realtime: On"**

### 1.5 Verify RLS Policies
1. Go to **Table Editor** → `power_readings`
2. Click the **"Policies"** tab
3. You should see:
   - `Allow insert for all` (INSERT with CHECK true)
   - `Allow read for all` (SELECT using true)

## Step 2: Deploy Dashboard to Vercel

### 2.1 Push to GitHub
```bash
cd dashboard/
git init
git add .
git commit -m "Power monitor dashboard"
git remote add origin https://github.com/YOUR_USERNAME/power-monitor-dashboard.git
git push -u origin main
```

### 2.2 Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → Sign up / Log in
2. Click **"Add New"** → **"Project"**
3. **Import** your GitHub repository
4. In **Configure Project**:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (or `dashboard/` if it's a monorepo)
5. Click **"Environment Variables"** and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...your_anon_key...
   ```
6. Click **"Deploy"** 🎉

### 2.3 Verify Deployment
- Vercel will give you a URL like `https://power-monitor-dashboard.vercel.app`
- Open it — you should see the dashboard with "Waiting for data..." message

## Step 3: Configure ESP32

### 3.1 Install Arduino Libraries
Open Arduino IDE → **Sketch** → **Include Library** → **Manage Libraries**:
- Search **"ESPSupabase"** → Install (by jhagas)
- Search **"ArduinoJson"** → Install (by Benoit Blanchon)

### 3.2 Edit Firmware Config
Open `firmware/power_monitor/power_monitor.ino` and edit:
```cpp
const char* WIFI_SSID     = "YourActualWiFiName";
const char* WIFI_PASSWORD  = "YourActualWiFiPassword";
const char* SUPABASE_URL   = "https://YOUR_PROJECT_ID.supabase.co";
const char* SUPABASE_KEY   = "eyJ...your_actual_anon_key...";
```

### 3.3 Upload to ESP32
1. Connect ESP32 via USB
2. Select board: **Tools** → **Board** → **ESP32 Dev Module**
3. Select port: **Tools** → **Port** → (your COM port)
4. Click **Upload** ➡️
5. Open **Serial Monitor** (115200 baud)

### 3.4 Verify Data Flow
You should see:
```
=== ESP32 Power Monitor (ZMPT101B + SCT-013) ===
Connecting to YourWiFi.....
WiFi connected!
  IP: 192.168.1.42
Setup complete.

[2.0s] V=230.1V  I=0.435A  P=100.1W
  OK Sent to Supabase
```

And the Vercel dashboard should start showing live data! 🎉

## Step 4: Custom Domain (Optional)

### On Vercel:
1. Go to your project → **Settings** → **Domains**
2. Add your domain (e.g., `power-monitor.yourdomain.com`)
3. Follow the DNS instructions (add a CNAME record pointing to `cname.vercel-dns.com`)

## Architecture Summary

```
┌─────────────┐    ADC     ┌──────────────┐
│  ZMPT101B   │───────────▶│              │
│  (Voltage)  │  GPIO 36   │              │
└─────────────┘            │    ESP32     │
                           │              │    WiFi/HTTP    ┌──────────────┐
┌─────────────┐    ADC     │  Read sensors│────────────────▶│   Supabase   │
│  SCT-013    │───────────▶│  Send JSON   │   POST /rest   │  (PostgreSQL │
│  (Current)  │  GPIO 39   │  every 2s    │   /v1/power_   │   + Realtime)│
└─────────────┘            │              │   readings     │              │
                           └──────────────┘                └──────┬───────┘
                                                                  │
                                                          Realtime subscription
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │   Vercel     │
                                                           │  (Next.js    │
                                                           │   Dashboard) │
                                                           │              │
                                                           │  ┌────────┐  │
                                                           │  │ Chart  │  │
                                                           │  │ Gauges │  │
                                                           │  │ Table  │  │
                                                           │  └────────┘  │
                                                           └──────────────┘
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │   Browser    │
                                                           │  (Your phone │
                                                           │   / laptop)  │
                                                           └──────────────┘
```

## Cost Estimate

| Service | Free Tier | Your Usage |
|---------|-----------|------------|
| **Supabase** | 500MB DB, 2GB bandwidth, 500K MAU | ~1 reading/2s = ~13K rows/day. Well within free tier |
| **Vercel** | 100GB bandwidth, 6000 build minutes | Dashboard is lightweight. Well within free tier |
| **ESP32** | N/A | ~$5 one-time |
| **Sensors** | N/A | ~$8 one-time |
| **Total** | **$0/month** | **~$13 one-time hardware** |

## Troubleshooting

### "Waiting for data..." on dashboard
1. Check ESP32 Serial Monitor — is it sending data?
2. Check Supabase Table Editor — are rows appearing in `power_readings`?
3. Check browser console (F12) for errors
4. Verify environment variables in Vercel dashboard

### Supabase inserts failing
1. Check RLS policies are set correctly
2. Verify the anon key (not the service_role key)
3. Check the table name matches exactly: `power_readings`

### Realtime not working
1. Make sure Realtime is enabled on the table (Database → Replication)
2. Check browser console for WebSocket errors
3. Some ad blockers block WebSocket connections — try incognito mode
