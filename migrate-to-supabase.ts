import { sql } from 'drizzle-orm';
import { db } from './server/db/database';

async function migrate() {
  console.log('🔄 Creating tables in Supabase...');
  
  try {
    // Create all tables using raw SQL based on the schema
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS generation_mode AS ENUM('keywords', 'title', 'topic');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS article_status AS ENUM('draft', 'in_progress', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS post_status AS ENUM('draft', 'published');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS job_status AS ENUM('pending', 'processing', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS webhook_event_type AS ENUM('post_published', 'post_updated', 'post_deleted');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE IF NOT EXISTS delivery_status AS ENUM('pending', 'success', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    console.log('✅ Enums created');
    
    // Create tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'client_editor',
        client_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        github_repo_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        api_key_hash TEXT,
        webhook_secret VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        featured_image_url TEXT,
        seo_title VARCHAR(255),
        seo_description TEXT,
        seo_keywords TEXT,
        status post_status NOT NULL DEFAULT 'draft',
        published_at TIMESTAMP,
        scheduled_for TIMESTAMP,
        content_hash VARCHAR(64),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(site_id, slug)
      );
      
      CREATE TABLE IF NOT EXISTS post_slugs (
        id SERIAL PRIMARY KEY,
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        old_slug VARCHAR(500) NOT NULL,
        new_slug VARCHAR(500) NOT NULL,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(site_id, old_slug)
      );
      
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        events TEXT[] NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type webhook_event_type NOT NULL,
        payload JSONB NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        status delivery_status NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id UUID,
        scheduled_date TIMESTAMP NOT NULL,
        status job_status NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        storage_path TEXT NOT NULL,
        public_url TEXT NOT NULL,
        mime_type VARCHAR(100),
        size_bytes INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        month DATE NOT NULL,
        article_count INTEGER NOT NULL DEFAULT 0,
        limit_count INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, month)
      );
      
      CREATE TABLE IF NOT EXISTS user_repos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        repo_name VARCHAR(255) NOT NULL,
        repo_url TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, client_id)
      );
      
      CREATE TABLE IF NOT EXISTS articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic VARCHAR(500),
        title VARCHAR(500),
        content TEXT,
        meta_description TEXT,
        keywords TEXT,
        status article_status NOT NULL DEFAULT 'draft',
        scheduled_date TIMESTAMP,
        notion_page_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id INTEGER
      );
    `);
    
    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
