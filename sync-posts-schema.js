import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

console.log('Synchronizing posts table schema with shared/schema.ts...\n');

// Complete list of columns from shared/schema.ts posts table
const requiredColumns = [
  { name: 'id', type: 'uuid PRIMARY KEY DEFAULT gen_random_uuid()', nullable: false },
  { name: 'site_id', type: 'uuid NOT NULL', nullable: false },
  { name: 'title', type: 'text NOT NULL', nullable: false },
  { name: 'slug', type: 'text NOT NULL', nullable: false },
  { name: 'excerpt', type: 'text', nullable: true },
  { name: 'body_md', type: 'text NOT NULL DEFAULT \'\'', nullable: false },
  { name: 'body_html', type: 'text', nullable: true },
  { name: 'tags', type: 'text[] DEFAULT \'{}\'', nullable: true },
  { name: 'cover_image_url', type: 'text', nullable: true },
  { name: 'meta_title', type: 'text', nullable: true },
  { name: 'meta_description', type: 'text', nullable: true },
  { name: 'og_image_url', type: 'text', nullable: true },
  { name: 'canonical_url', type: 'text', nullable: true },
  { name: 'noindex', type: 'boolean DEFAULT false', nullable: true },
  { name: 'status', type: 'post_status DEFAULT \'draft\' NOT NULL', nullable: false },
  { name: 'published_at', type: 'timestamp', nullable: true },
  { name: 'updated_at', type: 'timestamp DEFAULT now() NOT NULL', nullable: false },
  { name: 'content_hash', type: 'uuid NOT NULL', nullable: false },
];

async function getExistingColumns() {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'posts'
  `;
  return result.map(row => row.column_name);
}

async function addMissingColumns() {
  const existingColumns = await getExistingColumns();
  console.log('Existing columns:', existingColumns.join(', ') + '\n');

  let addedCount = 0;

  for (const column of requiredColumns) {
    if (!existingColumns.includes(column.name)) {
      try {
        console.log(`❌ Missing: "${column.name}" - adding...`);
        await sql.unsafe(`ALTER TABLE posts ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✅ Added: "${column.name}"\n`);
        addedCount++;
      } catch (err) {
        console.error(`⚠️  Error adding "${column.name}":`, err.message, '\n');
      }
    } else {
      console.log(`✅ Exists: "${column.name}"`);
    }
  }

  return addedCount;
}

try {
  const addedCount = await addMissingColumns();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Schema synchronization complete!`);
  console.log(`   Added ${addedCount} new column(s)`);
  console.log('='.repeat(60));
} catch (err) {
  console.error('Fatal error:', err);
} finally {
  await sql.end();
}
