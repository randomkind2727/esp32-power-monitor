-- ── Supabase Database Schema for ESP32 Power Monitor ──
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/YOUR_PROJECT/sql)

-- ── 1. Main readings table ──
-- Stores every power reading from the ESP32

CREATE TABLE IF NOT EXISTS power_readings (
    id          BIGSERIAL PRIMARY KEY,
    device_id   TEXT NOT NULL DEFAULT 'unknown',
    voltage     REAL NOT NULL DEFAULT 0,       -- Volts (V)
    current     REAL NOT NULL DEFAULT 0,       -- Amps (A)
    power       REAL NOT NULL DEFAULT 0,       -- Watts (W) - apparent power
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast recent-data queries
CREATE INDEX IF NOT EXISTS idx_power_readings_created_at 
    ON power_readings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_power_readings_device 
    ON power_readings (device_id, created_at DESC);

-- ── 2. Enable Row Level Security (RLS) ──
ALTER TABLE power_readings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (ESP32 writes data)
CREATE POLICY "Allow insert for all" 
    ON power_readings FOR INSERT 
    WITH CHECK (true);

-- Allow anyone to read (dashboard reads data)
CREATE POLICY "Allow read for all" 
    ON power_readings FOR SELECT 
    USING (true);

-- ── 3. Enable Realtime ──
-- Go to: Database → Replication → Supabase Realtime → Enable on power_readings
-- Or run:
-- PUBLICATION supabase_realtime ADD TABLE power_readings;

-- ── 4. Auto-cleanup old data (optional) ──
-- Deletes readings older than 30 days
-- Run this as a pg_cron job or via an Edge Function

-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'cleanup_old_readings',
--   '0 3 * * *',  -- Every day at 3 AM
--   $$DELETE FROM power_readings WHERE created_at < NOW() - INTERVAL '30 days'$$
-- );

-- ── 5. Helper view for dashboard ──
-- Last 1000 readings, newest first

CREATE OR REPLACE VIEW recent_readings AS
SELECT 
    id,
    device_id,
    ROUND(voltage::numeric, 1) as voltage,
    ROUND(current::numeric, 3) as current,
    ROUND(power::numeric, 1) as power,
    created_at
FROM power_readings
ORDER BY created_at DESC
LIMIT 1000;

-- ── 6. Hourly energy summary (optional, for energy tracking) ──

CREATE TABLE IF NOT EXISTS energy_summary (
    id          BIGSERIAL PRIMARY KEY,
    device_id   TEXT NOT NULL DEFAULT 'unknown',
    hour        TIMESTAMPTZ NOT NULL,
    avg_voltage REAL DEFAULT 0,
    avg_current REAL DEFAULT 0,
    avg_power   REAL DEFAULT 0,
    max_power   REAL DEFAULT 0,
    min_power   REAL DEFAULT 0,
    kwh         REAL DEFAULT 0,  -- Estimated energy in kWh
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_energy_summary_hour 
    ON energy_summary (hour DESC);

-- ── 7. Function to get latest reading ──

CREATE OR REPLACE FUNCTION get_latest_reading()
RETURNS TABLE (
    id BIGINT,
    device_id TEXT,
    voltage REAL,
    current REAL,
    power REAL,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT pr.id, pr.device_id, pr.voltage, pr.current, pr.power, pr.created_at
    FROM power_readings pr
    ORDER BY pr.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ── 8. Function to get stats for a time range ──

CREATE OR REPLACE FUNCTION get_power_stats(
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
RETURNS TABLE (
    avg_voltage REAL,
    avg_current REAL,
    avg_power REAL,
    max_power REAL,
    min_power REAL,
    total_readings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(AVG(pr.voltage)::numeric, 1)::real,
        ROUND(AVG(pr.current)::numeric, 3)::real,
        ROUND(AVG(pr.power)::numeric, 1)::real,
        ROUND(MAX(pr.power)::numeric, 1)::real,
        ROUND(MIN(pr.power)::numeric, 1)::real,
        COUNT(*)
    FROM power_readings pr
    WHERE pr.created_at BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql;
