import postgres from 'postgres';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ajpkqayllmdzytrcgiwg:Iloveromi100%21@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function runMigration() {
  const sql = postgres(connectionString, { prepare: false });

  try {
    console.log('📖 Reading migration file...');
    const migration = fs.readFileSync('./migrations/0003_add_invitation_tokens.sql', 'utf8');

    console.log('🔄 Running migration...');
    await sql.unsafe(migration);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
