# Database Migration Plan - Critical Security & Schema Fixes

## Overview
This migration addresses critical security vulnerabilities and schema inconsistencies identified in the code review. The migration will be split into multiple phases to ensure safe deployment.

## Migration Strategy

### Phase 1: Security & Schema Foundation (Migration 0001)
**Goal**: Add RLS policies, site_members table, and fix critical schema issues

#### Changes:
1. **Enable Row Level Security (RLS)** on all tables
2. **Create `site_members` table** for many-to-many user-site relationships
3. **Add monthly limits to `sites` table**
4. **Fix `usage_tracking` schema** (change to track by site_id)
5. **Fix article slug uniqueness** (per-site instead of global)
6. **Add missing indexes** for performance
7. **Add `supabase_user_id` to users table** for RLS policies

#### Breaking Changes:
- `usage_tracking.user_id` → `usage_tracking.site_id`
- `articles.slug` uniqueness constraint changes to composite (site_id, slug)
- Users now assigned to sites via `site_members` table

### Phase 2: Client → Site Refactoring (Migration 0002)
**Goal**: Unify the data model to use site_id consistently

#### Changes:
1. **Add `site_id` columns** to tables that reference `client_id`
2. **Migrate data** from client_id to site_id (using 1:1 mapping)
3. **Update foreign keys** to reference sites instead of clients
4. **Deprecate `client_id` columns** (mark as nullable, keep for rollback)

#### Tables Affected:
- `users.client_id` → `users.site_id` (deprecated in favor of site_members)
- `articles.client_id` → `articles.site_id`

### Phase 3: Cleanup & Optimization (Migration 0003)
**Goal**: Remove deprecated columns after successful migration

#### Changes:
1. **Drop `client_id` columns** from all tables
2. **Potentially merge `clients` table into `sites`** (if no additional data needed)
3. **Add article revisions table** for audit trail

## Detailed Migration 0001: Security & Schema Foundation

### 1. Enable RLS on All Tables

```sql
-- Enable RLS
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
```

### 2. Add supabase_user_id to users table

```sql
ALTER TABLE users ADD COLUMN supabase_user_id uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX users_supabase_user_id_unique ON users(supabase_user_id);
```

### 3. Create site_members table

```sql
CREATE TYPE "public"."site_role" AS ENUM('owner', 'editor', 'viewer');

CREATE TABLE site_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role site_role NOT NULL DEFAULT 'editor',
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(site_id, user_id)
);

CREATE INDEX site_members_site_id_idx ON site_members(site_id);
CREATE INDEX site_members_user_id_idx ON site_members(user_id);
```

### 4. Add monthly limits to sites table

```sql
ALTER TABLE sites
  ADD COLUMN monthly_article_limit integer DEFAULT 50 NOT NULL,
  ADD COLUMN monthly_image_limit integer DEFAULT 100 NOT NULL;
```

### 5. Fix usage_tracking schema

```sql
-- Add site_id column
ALTER TABLE usage_tracking
  ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

-- Migrate existing data (user_id → site_id via users.client_id → sites.client_id)
UPDATE usage_tracking ut
SET site_id = s.id
FROM users u
JOIN sites s ON s.client_id = u.client_id
WHERE ut.user_id = u.id;

-- Make site_id required
ALTER TABLE usage_tracking ALTER COLUMN site_id SET NOT NULL;

-- Add images_generated column
ALTER TABLE usage_tracking
  ADD COLUMN images_generated integer DEFAULT 0;

-- Drop user_id and old client_id, rename to clarify
ALTER TABLE usage_tracking DROP COLUMN user_id;

-- Add unique constraint
CREATE UNIQUE INDEX usage_tracking_site_month_unique ON usage_tracking(site_id, month);
```

### 6. Fix article slug uniqueness

```sql
-- Drop global unique constraint
ALTER TABLE articles DROP CONSTRAINT articles_slug_unique;

-- Add site_id column first (will be populated in Phase 2)
ALTER TABLE articles ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE CASCADE;

-- Migrate data
UPDATE articles a
SET site_id = s.id
FROM sites s
WHERE a.client_id = s.client_id;

-- Make it required
ALTER TABLE articles ALTER COLUMN site_id SET NOT NULL;

-- Add composite unique constraint
CREATE UNIQUE INDEX articles_site_slug_unique ON articles(site_id, slug);
```

### 7. Add missing indexes

```sql
CREATE INDEX articles_client_id_idx ON articles(client_id);
CREATE INDEX articles_site_id_idx ON articles(site_id);
CREATE INDEX articles_user_id_idx ON articles(user_id);
CREATE INDEX articles_status_idx ON articles(status);
CREATE INDEX posts_published_at_idx ON posts(published_at);
CREATE INDEX posts_status_idx ON posts(status);
CREATE INDEX scheduled_jobs_scheduled_for_idx ON scheduled_jobs(scheduled_for);
CREATE INDEX scheduled_jobs_job_type_idx ON scheduled_jobs(job_type);
```

### 8. RLS Policies

#### Users Table Policies
```sql
-- Admins can see all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can update themselves
CREATE POLICY "Users can update themselves" ON users
  FOR UPDATE
  USING (supabase_user_id = auth.uid());
```

#### Articles Table Policies
```sql
-- Admins can see all articles
CREATE POLICY "Admins can view all articles" ON articles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update articles" ON articles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete articles" ON articles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Editors can create/update articles in their sites
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
```

#### Sites Table Policies
```sql
-- Admins can view all sites
CREATE POLICY "Admins can view all sites" ON sites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
```

#### Posts Table Policies (Headless CMS)
```sql
-- Note: Posts are accessed via CMS API with JWT, not Supabase Auth
-- RLS policies here are for admin dashboard access only

CREATE POLICY "Admins can manage all posts" ON posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
```

#### Usage Tracking Policies
```sql
CREATE POLICY "Admins can view all usage" ON usage_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_user_id = auth.uid()
      AND users.role = 'admin'
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
```

#### Assets, Webhooks, Scheduled Jobs Policies
```sql
-- Similar pattern: admins see all, users see their sites
CREATE POLICY "Admins can manage all assets" ON assets FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.supabase_user_id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Users can manage their site assets" ON assets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM site_members sm JOIN users u ON u.id = sm.user_id
    WHERE sm.site_id = assets.site_id AND u.supabase_user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all webhooks" ON webhooks FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.supabase_user_id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Users can manage their site webhooks" ON webhooks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM site_members sm JOIN users u ON u.id = sm.user_id
    WHERE sm.site_id = webhooks.site_id AND u.supabase_user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage webhook logs" ON webhook_delivery_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.supabase_user_id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admins can manage scheduled jobs" ON scheduled_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.supabase_user_id = auth.uid() AND users.role = 'admin'));
```

## Data Migration Steps

### Before Migration:
1. ✅ Backup database
2. ✅ Test migration on staging environment
3. ✅ Review all RLS policies
4. ✅ Ensure all existing users have valid client_id

### During Migration:
1. Run migration 0001
2. Populate `users.supabase_user_id` from Supabase auth
3. Create `site_members` records for existing users (based on users.client_id)
4. Verify RLS policies work correctly
5. Test admin and editor access

### After Migration:
1. Update application code to use new schema
2. Update auth service to check site_members
3. Update usage tracking to aggregate by site
4. Test all endpoints with admin and editor users

## Rollback Plan

If issues occur:
1. Drop RLS policies
2. Revert to using client_id
3. Drop site_members table
4. Restore from backup if necessary

## Code Changes Required

### 1. Auth Service (`server/services/auth.ts`)
- Check `site_members` table instead of `users.client_id`
- Support multi-site access for users
- Require invitation validation before auto-creating users

### 2. Storage Layer (`server/db/database.ts`)
- Update `getUsageTracking()` to use `site_id`
- Add `getSiteMembersBySiteId()`, `getSiteMembersByUserId()`
- Add methods for site role checks

### 3. API Routes (`server/routes.ts`)
- Use `site_id` instead of `client_id` where applicable
- Check site membership for authorization
- Aggregate usage by site

### 4. Frontend
- Update all `client_id` references to `site_id`
- Handle multi-site user access
- Update dashboard to show site-specific data

## Security Checklist

- [x] RLS enabled on all tables
- [x] Admin bypass policies created
- [x] Site-based access policies created
- [x] CMS API continues to use JWT (application-level)
- [x] Supabase user ID linked to internal users
- [ ] Invitation validation before user creation
- [ ] API key rotation documentation
- [ ] Test with non-admin users

## Testing Checklist

- [ ] Admin can see all sites/articles
- [ ] Editor can see only their site's articles
- [ ] Viewer has read-only access
- [ ] Multi-site users see correct data
- [ ] Usage limits work per-site
- [ ] CMS API still works (bypasses RLS)
- [ ] Article slug uniqueness per-site works
- [ ] Performance is acceptable with indexes

## Timeline Estimate

- Migration 0001: 2-3 days (schema + RLS)
- Code updates: 2-3 days (auth, storage, routes)
- Testing: 1-2 days
- **Total**: ~1 week for Phase 1
