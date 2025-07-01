/*
  # Fix User Schema Alignment

  1. Verify auth.users table structure
  2. Ensure user_id columns properly reference auth.users(id)
  3. Add any missing constraints or indexes
  4. Verify RLS policies are working correctly

  Note: The auth.users table is automatically created by Supabase Auth
  and has a uuid primary key (id) by default.
*/

-- Verify that user_id columns are properly typed and constrained
DO $$
BEGIN
  -- Check if user_id columns exist and are properly constrained
  
  -- For articles table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'user_id'
  ) THEN
    -- Ensure the foreign key constraint exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'articles' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
      AND kcu.referenced_table_name = 'users'
      AND kcu.referenced_table_schema = 'auth'
    ) THEN
      -- Add foreign key constraint if it doesn't exist
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
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'notion_connections' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
      AND kcu.referenced_table_name = 'users'
      AND kcu.referenced_table_schema = 'auth'
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
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'schedule_jobs' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
      AND kcu.referenced_table_name = 'users'
      AND kcu.referenced_table_schema = 'auth'
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

-- Verify RLS policies are properly configured
-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can manage their own articles" ON articles;
DROP POLICY IF EXISTS "Users can manage their own notion connections" ON notion_connections;
DROP POLICY IF EXISTS "Users can manage their own schedule jobs" ON schedule_jobs;

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

-- Ensure RLS is enabled on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;