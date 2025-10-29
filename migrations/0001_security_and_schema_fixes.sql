-- Migration 0001: Security & Schema Foundation
-- This migration addresses critical security vulnerabilities and schema inconsistencies
-- See MIGRATION_PLAN.md for full details

-- ============================================================================
-- PART 1: Add new columns and tables
-- ============================================================================

-- Add supabase_user_id to users table for RLS policies
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id uuid;
ALTER TABLE users ADD CONSTRAINT users_supabase_user_id_fkey
  FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_user_id_unique ON users(supabase_user_id);

-- Add monthly limits to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS monthly_article_limit integer DEFAULT 50 NOT NULL;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS monthly_image_limit integer DEFAULT 100 NOT NULL;

-- Create site_role enum for site_members table
DO $$ BEGIN
  CREATE TYPE site_role AS ENUM('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create site_members table for many-to-many user-site relationships
CREATE TABLE IF NOT EXISTS site_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role site_role NOT NULL DEFAULT 'editor',
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT site_members_site_user_unique UNIQUE(site_id, user_id)
);

CREATE INDEX IF NOT EXISTS site_members_site_id_idx ON site_members(site_id);
CREATE INDEX IF NOT EXISTS site_members_user_id_idx ON site_members(user_id);

-- ============================================================================
-- PART 2: Fix usage_tracking schema (user_id → site_id)
-- ============================================================================

-- Add site_id column to usage_tracking
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS site_id uuid;
ALTER TABLE usage_tracking ADD CONSTRAINT usage_tracking_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- Migrate existing data: user_id → site_id via users.client_id → sites.client_id
UPDATE usage_tracking ut
SET site_id = s.id
FROM users u
JOIN sites s ON s.client_id = u.client_id
WHERE ut.user_id = u.id
AND ut.site_id IS NULL;

-- Make site_id required after data migration
ALTER TABLE usage_tracking ALTER COLUMN site_id SET NOT NULL;

-- Add images_generated column
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS images_generated integer DEFAULT 0;

-- Rename client_id to old_client_id (deprecate but keep for rollback)
DO $$ BEGIN
  ALTER TABLE usage_tracking RENAME COLUMN client_id TO old_client_id;
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

-- Rename user_id to old_user_id (deprecate but keep for rollback)
DO $$ BEGIN
  ALTER TABLE usage_tracking RENAME COLUMN user_id TO old_user_id;
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

-- Add unique constraint for site + month
CREATE UNIQUE INDEX IF NOT EXISTS usage_tracking_site_month_unique ON usage_tracking(site_id, month);

-- ============================================================================
-- PART 3: Fix article slug uniqueness (global → per-site)
-- ============================================================================

-- Add site_id column to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS site_id uuid;
ALTER TABLE articles ADD CONSTRAINT articles_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

-- Migrate data: client_id → site_id
UPDATE articles a
SET site_id = s.id
FROM sites s
WHERE a.client_id = s.client_id
AND a.site_id IS NULL;

-- Make site_id required after data migration
ALTER TABLE articles ALTER COLUMN site_id SET NOT NULL;

-- Drop global unique constraint on slug
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_slug_unique;

-- Add composite unique constraint (site_id + slug)
CREATE UNIQUE INDEX IF NOT EXISTS articles_site_slug_unique ON articles(site_id, slug);

-- ============================================================================
-- PART 4: Add missing indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS articles_client_id_idx ON articles(client_id);
CREATE INDEX IF NOT EXISTS articles_site_id_idx ON articles(site_id);
CREATE INDEX IF NOT EXISTS articles_user_id_idx ON articles(user_id);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts(published_at);
CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
CREATE INDEX IF NOT EXISTS scheduled_jobs_scheduled_for_idx ON scheduled_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_jobs_job_type_idx ON scheduled_jobs(job_type);
CREATE INDEX IF NOT EXISTS usage_tracking_old_client_id_idx ON usage_tracking(old_client_id);

-- ============================================================================
-- PART 5: Enable Row Level Security (RLS) on all tables
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: RLS Policies - Users Table
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view themselves" ON users;
DROP POLICY IF EXISTS "Users can view site members" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can update themselves" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Admins can see all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Users can view themselves
CREATE POLICY "Users can view themselves" ON users
  FOR SELECT
  USING (supabase_user_id = auth.uid());

-- Users can view other users in their sites
CREATE POLICY "Users can view site members" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm1
      JOIN site_members sm2 ON sm1.site_id = sm2.site_id
      JOIN users u ON u.id = sm2.user_id
      WHERE sm1.user_id = users.id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Admins can update all users
CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Users can update themselves
CREATE POLICY "Users can update themselves" ON users
  FOR UPDATE
  USING (supabase_user_id = auth.uid());

-- Admins can create users
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Admins can delete users
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- ============================================================================
-- PART 7: RLS Policies - Articles Table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all articles" ON articles;
DROP POLICY IF EXISTS "Users can view their site articles" ON articles;
DROP POLICY IF EXISTS "Admins can insert articles" ON articles;
DROP POLICY IF EXISTS "Admins can update articles" ON articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON articles;
DROP POLICY IF EXISTS "Editors can insert articles" ON articles;
DROP POLICY IF EXISTS "Editors can update articles" ON articles;
DROP POLICY IF EXISTS "Editors can delete articles" ON articles;

-- Admins can see all articles
CREATE POLICY "Admins can view all articles" ON articles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Users can see articles from their sites
CREATE POLICY "Users can view their site articles" ON articles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = articles.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Admins can create/update/delete all articles
CREATE POLICY "Admins can insert articles" ON articles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can update articles" ON articles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete articles" ON articles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Editors can create/update/delete articles in their sites
CREATE POLICY "Editors can insert articles" ON articles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = articles.site_id
      AND u.supabase_user_id = auth.uid()
      AND sm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Editors can update articles" ON articles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = articles.site_id
      AND u.supabase_user_id = auth.uid()
      AND sm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Editors can delete articles" ON articles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = articles.site_id
      AND u.supabase_user_id = auth.uid()
      AND sm.role IN ('owner', 'editor')
    )
  );

-- ============================================================================
-- PART 8: RLS Policies - Sites Table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all sites" ON sites;
DROP POLICY IF EXISTS "Users can view their sites" ON sites;
DROP POLICY IF EXISTS "Admins can manage sites" ON sites;
DROP POLICY IF EXISTS "Owners can update sites" ON sites;

-- Admins can view all sites
CREATE POLICY "Admins can view all sites" ON sites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Users can view their sites
CREATE POLICY "Users can view their sites" ON sites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = sites.id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Admins can manage all sites
CREATE POLICY "Admins can manage sites" ON sites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Site owners can update their sites
CREATE POLICY "Owners can update sites" ON sites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = sites.id
      AND u.supabase_user_id = auth.uid()
      AND sm.role = 'owner'
    )
  );

-- ============================================================================
-- PART 9: RLS Policies - Posts Table (Headless CMS)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all posts" ON posts;
DROP POLICY IF EXISTS "Users can manage their site posts" ON posts;

-- Note: Posts are accessed via CMS API with JWT, not Supabase Auth
-- RLS policies here are for admin dashboard access only

CREATE POLICY "Admins can manage all posts" ON posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their site posts" ON posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = posts.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 10: RLS Policies - Usage Tracking
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can view their site usage" ON usage_tracking;
DROP POLICY IF EXISTS "Admins can manage usage" ON usage_tracking;

CREATE POLICY "Admins can view all usage" ON usage_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can view their site usage" ON usage_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = usage_tracking.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage usage" ON usage_tracking
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- ============================================================================
-- PART 11: RLS Policies - Assets, Webhooks, and Other Tables
-- ============================================================================

-- Assets
DROP POLICY IF EXISTS "Admins can manage all assets" ON assets;
DROP POLICY IF EXISTS "Users can manage their site assets" ON assets;

CREATE POLICY "Admins can manage all assets" ON assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their site assets" ON assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = assets.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Webhooks
DROP POLICY IF EXISTS "Admins can manage all webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can manage their site webhooks" ON webhooks;

CREATE POLICY "Admins can manage all webhooks" ON webhooks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their site webhooks" ON webhooks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = webhooks.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Webhook Delivery Logs
DROP POLICY IF EXISTS "Admins can view webhook logs" ON webhook_delivery_logs;
DROP POLICY IF EXISTS "Users can view their site webhook logs" ON webhook_delivery_logs;

CREATE POLICY "Admins can view webhook logs" ON webhook_delivery_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can view their site webhook logs" ON webhook_delivery_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM webhooks w
      JOIN site_members sm ON sm.site_id = w.site_id
      JOIN users u ON u.id = sm.user_id
      WHERE w.id = webhook_delivery_logs.webhook_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Scheduled Jobs (admin only)
DROP POLICY IF EXISTS "Admins can manage scheduled jobs" ON scheduled_jobs;

CREATE POLICY "Admins can manage scheduled jobs" ON scheduled_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Post Slugs
DROP POLICY IF EXISTS "Admins can manage post slugs" ON post_slugs;
DROP POLICY IF EXISTS "Users can view their site post slugs" ON post_slugs;

CREATE POLICY "Admins can manage post slugs" ON post_slugs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can view their site post slugs" ON post_slugs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN site_members sm ON sm.site_id = p.site_id
      JOIN users u ON u.id = sm.user_id
      WHERE p.id = post_slugs.post_id
      AND u.supabase_user_id = auth.uid()
    )
  );

-- Site Members (users can view their memberships, admins can manage all)
DROP POLICY IF EXISTS "Users can view their site memberships" ON site_members;
DROP POLICY IF EXISTS "Admins can manage all memberships" ON site_members;
DROP POLICY IF EXISTS "Site owners can manage their site members" ON site_members;

CREATE POLICY "Users can view their site memberships" ON site_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = site_members.user_id
      AND u.supabase_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = site_members.site_id
      AND u.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all memberships" ON site_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Site owners can manage their site members" ON site_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.site_id = site_members.site_id
      AND u.supabase_user_id = auth.uid()
      AND sm.role = 'owner'
    )
  );

-- ============================================================================
-- PART 12: Data Migration - Populate site_members from existing users
-- ============================================================================

-- Migrate existing users with client_id to site_members
-- This creates a site_member record for each user that has a client_id
INSERT INTO site_members (site_id, user_id, role)
SELECT
  s.id as site_id,
  u.id as user_id,
  CASE
    WHEN u.role = 'admin' THEN 'owner'::site_role
    WHEN u.role = 'client_editor' THEN 'editor'::site_role
    ELSE 'viewer'::site_role
  END as role
FROM users u
JOIN sites s ON s.client_id = u.client_id
WHERE u.client_id IS NOT NULL
ON CONFLICT (site_id, user_id) DO NOTHING;

-- ============================================================================
-- PART 13: Comments and Notes
-- ============================================================================

COMMENT ON TABLE site_members IS 'Many-to-many relationship between users and sites with role-based access';
COMMENT ON COLUMN users.supabase_user_id IS 'References auth.users for RLS policies';
COMMENT ON COLUMN usage_tracking.site_id IS 'Tracks usage per site (aggregate across all site users)';
COMMENT ON COLUMN articles.site_id IS 'Direct reference to site (replaces client_id)';
COMMENT ON INDEX articles_site_slug_unique IS 'Ensures slug uniqueness per site (not globally)';

-- Migration complete!
-- Next steps:
-- 1. Populate users.supabase_user_id with actual Supabase auth UIDs
-- 2. Update application code to use new schema
-- 3. Test RLS policies with admin and editor users
-- 4. Run Phase 2 migration to fully deprecate client_id
