import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

console.log('Checking and fixing posts table schema...\n');

async function addColumnIfMissing(columnName, columnType, defaultValue = null) {
  try {
    // Check if column exists
    const result = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posts' AND column_name = ${columnName}
    `;

    if (result.length === 0) {
      console.log(`❌ Column "${columnName}" is missing, adding it now...`);
      const alterQuery = defaultValue
        ? `ALTER TABLE posts ADD COLUMN ${columnName} ${columnType} DEFAULT ${defaultValue}`
        : `ALTER TABLE posts ADD COLUMN ${columnName} ${columnType}`;

      await sql.unsafe(alterQuery);
      console.log(`✅ Successfully added "${columnName}" column\n`);
    } else {
      console.log(`✅ Column "${columnName}" already exists\n`);
    }
  } catch (err) {
    console.error(`Error with column "${columnName}":`, err.message);
  }
}

try {
  // Add all missing columns based on shared/schema.ts
  await addColumnIfMissing('body_md', 'text', "''");
  await addColumnIfMissing('body_html', 'text');
  await addColumnIfMissing('tags', 'text[]', "'{}'");

  console.log('\n✅ Posts table schema check complete!');
} catch (err) {
  console.error('Error:', err);
} finally {
  await sql.end();
}
