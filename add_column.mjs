import { createClient } from '@supabase/supabase-js';

// Vercel 환경 변수 로드 시도
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Checking Supabase credentials...');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ Found' : '❌ Missing');
console.log('SUPABASE_KEY:', SUPABASE_KEY ? '✅ Found' : '❌ Missing');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ Missing Supabase credentials!');
  console.log('\n📋 Please add company_id column manually in Supabase SQL Editor:');
  console.log('\nALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT \'\';');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function addColumn() {
  try {
    console.log('\n🔍 Checking if company_id column exists...');
    
    // Try to select company_id to see if it exists
    const { data, error } = await supabase
      .from('archived_articles')
      .select('company_id')
      .limit(1);
    
    if (error) {
      if (error.message.includes('company_id')) {
        console.log('❌ Column does not exist yet');
        console.log('\n📋 Please run this SQL in Supabase SQL Editor (https://supabase.com/dashboard):');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ALTER TABLE archived_articles');
        console.log('ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT \'\';');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.error('Other error:', error);
      }
    } else {
      console.log('✅ Column company_id already exists!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

addColumn();
