/*
  # Add User Authentication Support

  1. Schema Changes
    - Add user_id columns to all tables
    - Handle existing data by creating a system user or removing orphaned records
    - Update RLS policies to be user-specific
    - Add proper indexes for performance

  2. Data Migration Strategy
    - For existing records, we'll delete them since they're not associated with any user
    - In production, you might want to assign them to a specific user instead
    - New records will require user_id

  3. Security
    - Replace public policies with user-specific RLS policies
    - Ensure users can only access their own data
*/

-- First, add user_id columns as nullable
DO $$
BEGIN
  -- Add user_id to articles table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE articles ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to notion_connections table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notion_connections ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to schedule_jobs table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_jobs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE schedule_jobs ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Clean up existing data that doesn't have user associations
-- WARNING: This will delete existing data. In production, you might want to:
-- 1. Create a system user and assign orphaned records to them, OR
-- 2. Export the data first, OR  
-- 3. Manually assign records to specific users

-- Delete orphaned schedule_jobs first (due to foreign key constraints)
DELETE FROM schedule_jobs WHERE user_id IS NULL;

-- Delete orphaned articles
DELETE FROM articles WHERE user_id IS NULL;

-- Delete orphaned notion_connections
DELETE FROM notion_connections WHERE user_id IS NULL;

-- Now make user_id columns NOT NULL since we've cleaned up the data
DO $$
BEGIN
  -- For articles table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE articles ALTER COLUMN user_id SET NOT NULL;
  END IF;

  -- For notion_connections table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE notion_connections ALTER COLUMN user_id SET NOT NULL;
  END IF;

  -- For schedule_jobs table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_jobs' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE schedule_jobs ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Drop existing public policies
DROP POLICY IF EXISTS "Public can manage articles" ON articles;
DROP POLICY IF EXISTS "Public can manage notion connections" ON notion_connections;
DROP POLICY IF EXISTS "Public can manage schedule jobs" ON schedule_jobs;

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

-- Create indexes for user-based queries
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_connections_user_id ON notion_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_user_id ON schedule_jobs(user_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_user_status ON articles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_user_created ON articles(user_id, created_at);