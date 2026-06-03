#!/bin/bash
# ── Supabase Database Setup Script ──
# Run this script to set up the database schema for the Power Monitor dashboard
#
# Prerequisites:
#   - Node.js installed
#   - Your Supabase anon key
#
# Usage:
#   bash setup_db.sh

set -e

SUPABASE_URL="https://mybluvemghavqsaumrzv.supabase.co"
ANON_KEY="eyJhbG...64"
DB_PASSWORD="6gUfMkQK4Rd5d3x@"

echo "── Setting up Supabase Database ──"

# Install pg module temporarily
npm init -y > /dev/null 2>&1
npm install pg > /dev/null 2>&1

node -e "
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    host: 'db.mybluvemghavqsaumrzv.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '$DB_PASSWORD',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected!');

    const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
    console.log('Running schema...');
    await client.query(schema);
    console.log('✅ Schema created successfully!');

    // Verify
    const tables = await client.query(
      \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\"
    );
    console.log('');
    console.log('📊 Tables created:');
    tables.rows.forEach(r => console.log('  ✅ ' + r.table_name));

    console.log('');
    console.log('📌 Next steps:');
    console.log('1. Go to https://app.supabase.com/project/mybluvemghavqsaumrzv');
    console.log('2. Database → Replication → Enable Realtime on power_readings');
    console.log('3. Done! Your dashboard will now receive data from ESP32.');

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
"

# Cleanup
rm -f package.json package-lock.json
