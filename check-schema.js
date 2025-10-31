import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL);

async function checkSchema() {
  try {
    console.log('📊 Checking usage_tracking table schema...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usage_tracking'
      ORDER BY ordinal_position
    `;

    console.log('Columns in usage_tracking:');
    console.table(columns);

    console.log('\n📊 Checking sites table schema...');
    const siteColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sites'
      ORDER BY ordinal_position
    `;

    console.log('Columns in sites:');
    console.table(siteColumns);

    console.log('\n📊 Checking if site_members table exists...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'site_members'
    `;

    console.log('site_members exists:', tables.length > 0);

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

checkSchema();
