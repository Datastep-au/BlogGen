import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

console.log('Adding missing columns to posts table...');

try {
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS body_html text`;
  console.log('✅ Successfully added body_html column');
} catch (err) {
  console.error('Error adding body_html:', err);
}

await sql.end();
