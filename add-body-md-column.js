import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Adding body_md column to posts table...');

// Execute the ALTER TABLE statement
const { data, error } = await supabase.rpc('execute_sql', {
  query: 'ALTER TABLE posts ADD COLUMN IF NOT EXISTS body_md text NOT NULL DEFAULT \'\';'
});

if (error) {
  console.error('Error:', error);
  // Try an alternative approach using raw query
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.DATABASE_URL);

  try {
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS body_md text NOT NULL DEFAULT ''`;
    console.log('✅ Successfully added body_md column using direct connection');
  } catch (err) {
    console.error('Direct query also failed:', err);
  } finally {
    await sql.end();
  }
} else {
  console.log('✅ Successfully added body_md column');
}
