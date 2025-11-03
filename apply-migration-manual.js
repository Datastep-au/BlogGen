import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = postgres(DATABASE_URL);

async function applyMigration() {
  try {
    console.log('🚀 Step 1: Adding supabase_user_id to users table...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id uuid UNIQUE
    `;
    console.log('✅ users.supabase_user_id added');

    console.log('\n🚀 Step 2: Adding monthly limits to sites table...');
    await sql`
      ALTER TABLE sites
      ADD COLUMN IF NOT EXISTS monthly_article_limit integer DEFAULT 10 NOT NULL,
      ADD COLUMN IF NOT EXISTS monthly_image_limit integer DEFAULT 100 NOT NULL
    `;
    await sql`
      ALTER TABLE sites
      ALTER COLUMN monthly_article_limit SET DEFAULT 10
    `;
    await sql`
      UPDATE sites
      SET monthly_article_limit = 10
      WHERE monthly_article_limit IS NULL OR monthly_article_limit > 10
    `;
    console.log('✅ sites monthly limits added and normalized');

    console.log('\n🚀 Step 3: Creating site_role enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE site_role AS ENUM ('owner', 'editor', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ site_role enum created');

    console.log('\n🚀 Step 4: Creating site_members table...');
    await sql`
      CREATE TABLE IF NOT EXISTS site_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role site_role DEFAULT 'editor' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        UNIQUE(site_id, user_id)
      )
    `;
    console.log('✅ site_members table created');

    console.log('\n🚀 Step 5: Migrating existing users to site_members...');
    await sql`
      INSERT INTO site_members (site_id, user_id, role)
      SELECT s.id, u.id, 'editor'::site_role
      FROM users u
      JOIN sites s ON s.client_id = u.client_id
      WHERE u.client_id IS NOT NULL
      ON CONFLICT (site_id, user_id) DO NOTHING
    `;
    const migrated = await sql`SELECT COUNT(*) as count FROM site_members`;
    console.log(`✅ Migrated ${migrated[0].count} user-site relationships`);

    console.log('\n🚀 Step 6: Adding site_id to usage_tracking...');
    await sql`
      ALTER TABLE usage_tracking
      ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id)
    `;
    console.log('✅ usage_tracking.site_id added');

    console.log('\n🚀 Step 7: Migrating usage_tracking data to use site_id...');
    await sql`
      UPDATE usage_tracking ut
      SET site_id = s.id
      FROM sites s
      WHERE s.client_id = ut.client_id
      AND ut.site_id IS NULL
    `;
    console.log('✅ usage_tracking data migrated to site_id');

    console.log('\n🚀 Step 8: Adding images_generated column to usage_tracking...');
    await sql`
      ALTER TABLE usage_tracking
      ADD COLUMN IF NOT EXISTS images_generated integer DEFAULT 0 NOT NULL
    `;
    console.log('✅ usage_tracking.images_generated added');

    console.log('\n🚀 Step 9: Adding site_id to articles...');
    await sql`
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id)
    `;
    console.log('✅ articles.site_id added');

    console.log('\n🚀 Step 10: Migrating articles to use site_id...');
    await sql`
      UPDATE articles a
      SET site_id = s.id
      FROM sites s
      WHERE s.client_id = a.client_id
      AND a.site_id IS NULL
    `;
    const articlesMigrated = await sql`SELECT COUNT(*) as count FROM articles WHERE site_id IS NOT NULL`;
    console.log(`✅ ${articlesMigrated[0].count} articles migrated to site_id`);

    console.log('\n🚀 Step 11: Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS articles_site_id_idx ON articles(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status)`;
    await sql`CREATE INDEX IF NOT EXISTS site_members_site_id_idx ON site_members(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS site_members_user_id_idx ON site_members(user_id)`;
    console.log('✅ Indexes created');

    console.log('\n✨ Migration completed successfully!');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

applyMigration();
