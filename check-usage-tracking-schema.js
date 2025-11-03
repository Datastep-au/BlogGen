import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL);

async function checkUsageTrackingSchema() {
  try {
    console.log('📊 Checking usage_tracking table schema...\n');

    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'usage_tracking'
      ORDER BY ordinal_position
    `;

    console.log('Current columns:');
    console.table(columns);

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

checkUsageTrackingSchema();
