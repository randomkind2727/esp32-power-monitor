// Intercept Node.js built-in fetch to see what Supabase JS client sends
const origFetch = globalThis.fetch;

globalThis.fetch = async function(url, opts) {
  if (String(url).includes('supabase')) {
    console.log('=== Supabase fetch ===');
    console.log('URL:', url);
    console.log('Method:', opts?.method || 'GET');
    console.log('Headers:', JSON.stringify(opts?.headers, null, 2));
  }
  return origFetch.apply(this, arguments);
};

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mybluvemghavqsaumrzv.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_9DXxQMqcTpCuuc-5N2KsRw_RiPhhTNi';

async function main() {
  const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
  const { data, error } = await supabase.from('power_readings').select('*').limit(1);
  if (error) {
    console.log('\nError:', error.message);
  } else {
    console.log('\nData:', JSON.stringify(data));
  }
}

main().catch(console.error);
