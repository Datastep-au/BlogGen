-- Set default article limit to 10 and update existing records
ALTER TABLE sites
  ALTER COLUMN monthly_article_limit SET DEFAULT 10;

UPDATE sites
SET monthly_article_limit = 10
WHERE monthly_article_limit IS NULL OR monthly_article_limit > 10;
