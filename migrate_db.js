import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.log('SUPABASE_URL:', SUPABASE_URL ? 'exists' : 'missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  console.log('🔧 Starting database migration...');
  
  try {
    // Add company_id column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE archived_articles 
        ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT '';
      `
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative approach: check if column exists
      const { data: checkData, error: checkError } = await supabase
        .from('archived_articles')
        .select('company_id')
        .limit(1);
      
      if (checkError && checkError.message.includes('company_id')) {
        console.log('Column does not exist, need to add it manually via Supabase dashboard');
        console.log('\nPlease run this SQL in Supabase SQL Editor:');
        console.log('```sql');
        console.log('ALTER TABLE archived_articles');
        console.log('ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT \'\';');
        console.log('```');
      } else if (!checkError) {
        console.log('✅ Column company_id already exists!');
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

migrate();
