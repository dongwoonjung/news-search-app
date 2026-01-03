-- Add company_id column to archived_articles table
ALTER TABLE archived_articles 
ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT '';

-- Add index for better query performance on company_id
CREATE INDEX IF NOT EXISTS idx_archived_articles_company_id 
ON archived_articles(company_id);

-- Optional: Add index for combined category + company_id queries
CREATE INDEX IF NOT EXISTS idx_archived_articles_category_company 
ON archived_articles(category, company_id);
