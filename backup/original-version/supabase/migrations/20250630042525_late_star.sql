/*
  # Add Tracking Database to Notion Connections

  1. Schema Changes
    - Add `tracking_database_id` column to `notion_connections` table
    - This will store the Notion database ID for tracking articles

  2. Notes
    - Existing connections will have NULL tracking_database_id initially
    - Users can update their connections to add the tracking database
*/

-- Add tracking database ID column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_connections' AND column_name = 'tracking_database_id'
  ) THEN
    ALTER TABLE notion_connections ADD COLUMN tracking_database_id text;
  END IF;
END $$;