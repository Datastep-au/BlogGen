import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL);

async function dropClientIdColumn() {
  try {
    console.log('🔧 Dropping client_id column from usage_tracking...\n');

    await sql`ALTER TABLE usage_tracking DROP COLUMN IF EXISTS client_id`;
    console.log('✅ client_id column dropped successfully\n');

    // Verify
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'usage_tracking'
      ORDER BY ordinal_position
    `;

    console.log('Remaining columns:');
    console.table(columns);

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

dropClientIdColumn();
