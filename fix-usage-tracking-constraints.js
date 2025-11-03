import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL);

async function fixUsageTrackingConstraints() {
  try {
    console.log('🔧 Fixing usage_tracking table constraints...\n');

    // Step 1: Make client_id nullable (it's deprecated)
    console.log('Step 1: Making client_id nullable...');
    await sql`ALTER TABLE usage_tracking ALTER COLUMN client_id DROP NOT NULL`;
    console.log('✅ client_id is now nullable\n');

    // Step 2: Make site_id NOT NULL (it's the primary reference now)
    console.log('Step 2: Making site_id NOT NULL...');
    await sql`ALTER TABLE usage_tracking ALTER COLUMN site_id SET NOT NULL`;
    console.log('✅ site_id is now NOT NULL\n');

    // Step 3: Verify the changes
    console.log('Step 3: Verifying changes...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usage_tracking'
      AND column_name IN ('client_id', 'site_id')
      ORDER BY column_name
    `;

    console.log('Updated columns:');
    console.table(columns);

    console.log('\n✅ All constraints updated successfully!');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

fixUsageTrackingConstraints();
