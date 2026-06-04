// Deploy to Vercel using the REST API
// We need to create a deployment by uploading the build output
const https = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';

// First, let's check if we can use the Vercel CLI with a token
async function main() {
  console.log('=== Vercel Deployment Options ===\n');

  // Check for token
  if (!VERCEL_TOKEN) {
    console.log('No VERCEL_TOKEN environment variable set.');
    console.log('\nTo deploy to Vercel, you need a Vercel API token:');
    console.log('1. Go to https://vercel.com/account/tokens');
    console.log('2. Create a new token');
    console.log('3. Run: export VERCEL_TOKEN=your_token_here');
    console.log('4. Then re-run this script');
    console.log('\nOR use the GitHub integration (recommended):');
    console.log('1. Go to https://vercel.com/new');
    console.log('2. Import your GitHub repo');
    console.log('3. Add env vars in Vercel dashboard');
    console.log('4. Deploy!');
    return;
  }

  // If we have a token, deploy via API
  console.log('Token found, attempting deployment...');

  // Use the Vercel CLI with the token
  try {
    const result = execSync(`vercel deploy --prod --token ${VERCEL_TOKEN} --yes 2>&1`, {
      cwd: '/home/random/.hermes/power-monitor-project/dashboard',
      timeout: 120000,
      encoding: 'utf8',
    });
    console.log('Deployment result:', result);
  } catch (e) {
    console.log('Deployment error:', e.message);
    if (e.stdout) console.log('stdout:', e.stdout);
    if (e.stderr) console.log('stderr:', e.stderr);
  }
}

main().catch(console.error);
