/**
 * AUTOMATIC DATABASE MIGRATION SCRIPT
 * This will apply the database rebuild migration automatically
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase credentials
const SUPABASE_URL = 'https://uflztgsteldueczyxfbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbHp0Z3N0ZWxkdWVjenl4ZmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODk5MzgsImV4cCI6MjA4MDQ2NTkzOH0.-kpUn77qMtTNxDPYFpE8wc267pzymX6NyQT-s9ypLnA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyMigration() {
  console.log('🚀 Starting automatic database migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251205_FRESH_START_complete_rebuild.sql');
    const sqlContent = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded successfully');
    console.log(`📊 SQL script size: ${sqlContent.length} characters\n`);
    
    console.log('⏳ Executing migration (this may take 30-60 seconds)...\n');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });
    
    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('\n⚠️  The anon key cannot run DDL commands.');
      console.error('📋 You must apply this migration manually in Supabase Dashboard:\n');
      console.error('1. Go to: https://supabase.com/dashboard/project/uflztgsteldueczyxfbk/sql/new');
      console.error('2. Copy the entire content from: supabase/migrations/20251205_FRESH_START_complete_rebuild.sql');
      console.error('3. Paste into SQL Editor and click "Run"\n');
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!\n');
    console.log('🎉 Database is now ready. Refresh your browser to see the dashboard.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n📋 Manual steps required:\n');
    console.error('1. Open: https://supabase.com/dashboard/project/uflztgsteldueczyxfbk/sql/new');
    console.error('2. Copy content from: supabase/migrations/20251205_FRESH_START_complete_rebuild.sql');
    console.error('3. Paste and run in SQL Editor\n');
    process.exit(1);
  }
}

applyMigration();
