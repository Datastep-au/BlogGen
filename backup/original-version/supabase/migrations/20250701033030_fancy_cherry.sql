/*
  # Fix User Authentication and Foreign Key Constraints

  This migration ensures proper foreign key constraints and RLS policies for user authentication.
  
  1. Foreign Key Constraints
     - Adds proper foreign key constraints to auth.users for all user_id columns
     - Uses CASCADE delete to clean up user data when users are deleted
  
  2. Indexes
     - Creates indexes for efficient user-based queries
     - Adds composite indexes for common query patterns
  
  3. Row Level Security
     - Ensures RLS is enabled on all tables
     - Creates policies for user-specific data access
*/

-- First, let's check and fix foreign key constraints using a simpler approach
-- We'll drop existing constraints and recreate them properly

-- Drop existing foreign key constraints if they exist (ignore errors if they don't exist)
DO $$
BEGIN
  -- Drop existing foreign key constraints
  BEGIN
    ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_user_id_fkey;
    ALTER TABLE articles DROP CONSTRAINT IF EXISTS fk_articles_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors
  END;
  
  BEGIN
    ALTER TABLE notion_connections DROP CONSTRAINT IF EXISTS notion_connections_user_id_fkey;
    ALTER TABLE notion_connections DROP CONSTRAINT IF EXISTS fk_notion_connections_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors
  END;
  
  BEGIN
    ALTER TABLE schedule_jobs DROP CONSTRAINT IF EXISTS schedule_jobs_user_id_fkey;
    ALTER TABLE schedule_jobs DROP CONSTRAINT IF EXISTS fk_schedule_jobs_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors
  END;
END $$;

-- Add proper foreign key constraints to auth.users
ALTER TABLE articles 
ADD CONSTRAINT fk_articles_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE notion_connections 
ADD CONSTRAINT fk_notion_connections_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE schedule_jobs 
ADD CONSTRAINT fk_schedule_jobs_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure proper indexes exist for user-based queries
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_connections_user_id ON notion_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_user_id ON schedule_jobs(user_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_user_status ON articles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_user_created ON articles(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_date ON articles(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_scheduled_date ON schedule_jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_status ON schedule_jobs(status);

-- Ensure RLS is enabled on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own articles" ON articles;
DROP POLICY IF EXISTS "Users can manage their own notion connections" ON notion_connections;
DROP POLICY IF EXISTS "Users can manage their own schedule jobs" ON schedule_jobs;

-- Create user-specific RLS policies using auth.uid()
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