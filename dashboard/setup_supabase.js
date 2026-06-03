const { Client } = require('pg');
const fs = require('fs');

const passwords = ['6gUfMkQK4Rd5d3x@', 'BYJDZXwQJn0ahLUm'];
const schemaFile = '/home/random/.hermes/power-monitor-project/supabase/schema.sql';

async function main() {
  const schema = fs.readFileSync(schemaFile, 'utf8');
  
  for (const password of passwords) {
    console.log(`\nTrying password starting with: ${password.substring(0, 4)}...`);
    const client = new Client({
      host: 'db.mybluvemghavqsaumrzv.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: password,
      ssl: { rejectUnauthorized: false },
      family: 4  // Force IPv4
    });
    
    try {
      await client.connect();
      console.log('✅ Connected!');
      
      await client.query(schema);
      console.log('✅ Schema created!');
      
      const tables = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
      );
      console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
      
      await client.end();
      fs.writeFileSync('/tmp/supabase_password.txt', password);
      console.log('\n✅ Done!');
      return;
    } catch (err) {
      console.log('❌', err.message.substring(0, 200));
      try { await client.end(); } catch(e) {}
    }
  }
  console.log('Both passwords failed.');
}

main().catch(console.error);
