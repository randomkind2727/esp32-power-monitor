import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Fetch the single most recent reading */
export async function getLatestReading() {
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) { console.error('getLatestReading:', error); return null; }
  return data;
}

/** Fetch recent readings oldest-first for charts */
export async function getRecentReadings(limit = 200) {
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getRecentReadings:', error); return []; }
  return data.reverse();
}

/** Subscribe to INSERT events, returns the channel (call supabase.removeChannel on cleanup) */
export function subscribeToPowerReadings(callback) {
  const channel = supabase
    .channel('power-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'power_readings' },
      (payload) => callback(payload.new))
    .subscribe();
  return channel;
}

/** Get aggregate stats for a time window (hours) */
export async function getPowerStats(hours = 24) {
  const { data, error } = await supabase.rpc('get_power_stats', {
    start_time: new Date(Date.now() - hours * 3600000).toISOString(),
    end_time: new Date().toISOString(),
  });
  if (error) { console.error('getPowerStats:', error); return null; }
  return data?.[0] || null;
}

/** Get readings for today only */
export async function getTodaysReadings() {
  const start = new Date(); start.setHours(0,0,0,0);
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (error) { console.error('getTodaysReadings:', error); return []; }
  return data;
}

/** Get readings for the current week */
export async function getWeeklyReadings() {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0,0,0,0);
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (error) { console.error('getWeeklyReadings:', error); return []; }
  return data;
}

/** Get readings for the current month */
export async function getMonthlyReadings() {
  const start = new Date();
  start.setDate(1); start.setHours(0,0,0,0);
  const { data, error } = await supabase
    .from('power_readings')
    .select('*')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (error) { console.error('getMonthlyReadings:', error); return []; }
  return data;
}
