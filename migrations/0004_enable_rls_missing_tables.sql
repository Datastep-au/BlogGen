-- Migration 0004: Enable RLS on tables missing row level security
-- Fixes: clients, user_repos, invitation_tokens
-- Also idempotently re-applies ENABLE RLS on all other tables as a safety net

-- ============================================================================
-- PART 1: Enable RLS on ALL public tables (idempotent)
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Re-apply on existing tables (idempotent, no-op if already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: RLS Policies - Clients Table
-- Clients are top-level tenants; only admins can manage them.
-- Regular users can read the client they belong to.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own client" ON clients;

CREATE POLICY "Admins can manage all clients" ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own client" ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.client_id = clients.id
    )
  );

-- ============================================================================
-- PART 3: RLS Policies - User Repos Table
-- user_repos stores GitHub repo config per user/site.
-- Admins can manage all; users can manage their own.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all user repos" ON user_repos;
DROP POLICY IF EXISTS "Users can manage their own repos" ON user_repos;

CREATE POLICY "Admins can manage all user repos" ON user_repos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their own repos" ON user_repos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.id::text = user_repos.user_id::text
    )
  );

-- ============================================================================
-- PART 4: RLS Policies - Invitation Tokens Table
-- Invitation tokens are admin-managed. Users cannot see or modify them.
-- The backend uses the service role key to bypass RLS for token verification.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage invitation tokens" ON invitation_tokens;

CREATE POLICY "Admins can manage invitation tokens" ON invitation_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.supabase_user_id = auth.uid()
      AND u.role = 'admin'
    )
  );
