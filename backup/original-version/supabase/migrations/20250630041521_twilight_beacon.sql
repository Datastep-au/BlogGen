/*
  # Update Notion Connections for Page-based Storage

  1. Changes
    - Rename `database_id` column to `parent_page_id` in notion_connections table
    - Update any references to use page-based storage instead of database storage

  2. Migration Strategy
    - Add new column
    - Copy existing data if any
    - Drop old column
    - Update indexes and constraints
*/

-- Add new parent_page_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'parent_page_id'
  ) THEN
    ALTER TABLE notion_connections ADD COLUMN parent_page_id text;
  END IF;
END $$;

-- Copy data from database_id to parent_page_id if database_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'database_id'
  ) THEN
    UPDATE notion_connections SET parent_page_id = database_id WHERE parent_page_id IS NULL;
  END IF;
END $$;

-- Make parent_page_id NOT NULL after data migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'parent_page_id'
  ) THEN
    ALTER TABLE notion_connections ALTER COLUMN parent_page_id SET NOT NULL;
  END IF;
END $$;

-- Drop the old database_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'database_id'
  ) THEN
    ALTER TABLE notion_connections DROP COLUMN database_id;
  END IF;
END $$;