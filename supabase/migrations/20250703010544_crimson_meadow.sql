/*
  # Add Monthly Article Limits

  1. New Tables
    - `user_monthly_usage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `month` (date) - First day of the month
      - `article_count` (integer) - Number of articles generated
      - `limit_count` (integer) - Monthly limit (default 10)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on user_monthly_usage table
    - Add policies for users to read their own usage data

  3. Indexes
    - Add index on user_id and month for efficient queries
*/

-- Create user_monthly_usage table
CREATE TABLE IF NOT EXISTS user_monthly_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  article_count integer NOT NULL DEFAULT 0,
  limit_count integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable Row Level Security
ALTER TABLE user_monthly_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own usage data
CREATE POLICY "Users can read their own monthly usage"
  ON user_monthly_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policy for system to manage usage data
CREATE POLICY "System can manage monthly usage"
  ON user_monthly_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_user_month ON user_monthly_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_user_id ON user_monthly_usage(user_id);

-- Function to update monthly usage
CREATE OR REPLACE FUNCTION update_monthly_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the first day of the month for the article creation date
  DECLARE
    month_start date := date_trunc('month', NEW.created_at)::date;
  BEGIN
    -- Insert or update the monthly usage record
    INSERT INTO user_monthly_usage (user_id, month, article_count, limit_count)
    VALUES (NEW.user_id, month_start, 1, 10)
    ON CONFLICT (user_id, month)
    DO UPDATE SET 
      article_count = user_monthly_usage.article_count + 1,
      updated_at = now();
    
    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update monthly usage when articles are created
DROP TRIGGER IF EXISTS trigger_update_monthly_usage ON articles;
CREATE TRIGGER trigger_update_monthly_usage
  AFTER INSERT ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_usage();