// ── Supabase Client Configuration ──
// File: lib/supabase.js
//
// Install: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Helper: Fetch latest reading ──
export async function getLatestReading() {
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching latest reading:', error);
    return null;
  }
  return data;
}

// ── Helper: Fetch recent readings ──
export async function getRecentReadings(limit = 100) {
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent readings:', error);
    return [];
  }
  return data.reverse(); // Oldest first for charts
}

// ── Helper: Subscribe to realtime updates ──
export function subscribeToPowerReadings(callback) {
  const channel = supabase
    .channel('power-readings-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'power_readings',
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// ── Helper: Get stats for time range ──
export async function getPowerStats(hours = 24) {
  const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();

  const { data, error } = await supabase.rpc('get_power_stats', {
    start_time: start,
    end_time: end,
  });

  if (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
  return data?.[0] || null;
}
