import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigration() {
  try {
    console.log('📦 Reading migration file...');
    const migrationSQL = readFileSync('./migrations/0001_security_and_schema_fixes.sql', 'utf8');

    console.log('🚀 Running migration...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
