/*
  # Fix User Schema and Constraints
  
  This migration ensures that:
  1. All user_id columns have proper foreign key constraints to auth.users
  2. Proper indexes are created for user-based queries
  3. RLS policies are correctly configured for authenticated users
  4. All tables have RLS enabled
*/

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- For articles table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'user_id'
  ) THEN
    -- Check if foreign key constraint exists using pg_constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND t.relname = 'articles'
      AND c.contype = 'f'
      AND c.conname LIKE '%user_id%'
    ) THEN
      -- Add foreign key constraint
      ALTER TABLE articles 
      ADD CONSTRAINT fk_articles_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- For notion_connections table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'user_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND t.relname = 'notion_connections'
      AND c.contype = 'f'
      AND c.conname LIKE '%user_id%'
    ) THEN
      ALTER TABLE notion_connections 
      ADD CONSTRAINT fk_notion_connections_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- For schedule_jobs table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_jobs' AND column_name = 'user_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND t.relname = 'schedule_jobs'
      AND c.contype = 'f'
      AND c.conname LIKE '%user_id%'
    ) THEN
      ALTER TABLE schedule_jobs 
      ADD CONSTRAINT fk_schedule_jobs_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Ensure proper indexes exist for user-based queries
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_connections_user_id ON notion_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_user_id ON schedule_jobs(user_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_user_status ON articles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_user_created ON articles(user_id, created_at);

-- Drop any existing public policies first
DROP POLICY IF EXISTS "Public can manage articles" ON articles;
DROP POLICY IF EXISTS "Public can manage notion connections" ON notion_connections;
DROP POLICY IF EXISTS "Public can manage schedule jobs" ON schedule_jobs;

-- Drop any existing user policies to recreate them
DROP POLICY IF EXISTS "Users can manage their own articles" ON articles;
DROP POLICY IF EXISTS "Users can manage their own notion connections" ON notion_connections;
DROP POLICY IF EXISTS "Users can manage their own schedule jobs" ON schedule_jobs;

-- Ensure RLS is enabled on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;

-- Create user-specific RLS policies
CREATE POLICY "Users can manage their own articles"
  ON articles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own notion connections"
  ON notion_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own schedule jobs"
  ON schedule_jobs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);