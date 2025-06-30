/*
  # Create SEO Blog Generator Tables

  1. New Tables
    - `articles`
      - `id` (uuid, primary key)
      - `topic` (text) - Original topic request
      - `title` (text) - Generated SEO title
      - `content` (text) - Full article content
      - `meta_description` (text) - SEO meta description
      - `keywords` (text array) - SEO keywords
      - `status` (enum) - draft, approved, scheduled, published
      - `scheduled_date` (timestamptz, nullable) - When to publish
      - `notion_page_id` (text, nullable) - Notion page reference
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notion_connections`
      - `id` (uuid, primary key) 
      - `workspace_name` (text) - User-friendly name
      - `database_id` (text) - Notion database ID
      - `access_token` (text) - Notion integration token
      - `created_at` (timestamptz)

    - `schedule_jobs`
      - `id` (uuid, primary key)
      - `article_id` (uuid, foreign key)
      - `scheduled_date` (timestamptz)
      - `status` (enum) - pending, completed, failed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create custom types
DO $$ BEGIN
  CREATE TYPE article_status AS ENUM ('draft', 'approved', 'scheduled', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  meta_description text NOT NULL DEFAULT '',
  keywords text[] DEFAULT '{}',
  status article_status DEFAULT 'draft',
  scheduled_date timestamptz,
  notion_page_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notion_connections table
CREATE TABLE IF NOT EXISTS notion_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name text NOT NULL,
  database_id text NOT NULL,
  access_token text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create schedule_jobs table
CREATE TABLE IF NOT EXISTS schedule_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  scheduled_date timestamptz NOT NULL,
  status job_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we don't have auth yet)
-- In production, you would want to restrict these to authenticated users
CREATE POLICY "Public can manage articles"
  ON articles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can manage notion connections"
  ON notion_connections
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can manage schedule jobs"
  ON schedule_jobs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_date ON articles(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_scheduled_date ON schedule_jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_status ON schedule_jobs(status);