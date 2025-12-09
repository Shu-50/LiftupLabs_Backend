// Test Supabase connection
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl ? '✓ Found' : '✗ Missing');
console.log('Key:', supabaseKey ? '✓ Found' : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Supabase credentials missing in .env file');
    console.log('\nAdd these to your .env:');
    console.log('SUPABASE_URL=https://your-project.supabase.co');
    console.log('SUPABASE_ANON_KEY=your-anon-key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Test 1: Check if notes table exists
        console.log('\n📊 Testing database connection...');
        const { data, error } = await supabase
            .from('notes')
            .select('count')
            .limit(1);

        if (error) {
            if (error.message.includes('relation "public.notes" does not exist')) {
                console.log('❌ Notes table does NOT exist');
                console.log('\n📝 You need to create the database tables!');
                console.log('Follow these steps:');
                console.log('1. Go to your Supabase dashboard');
                console.log('2. Click on "SQL Editor"');
                console.log('3. Run the SQL from SUPABASE_SETUP.md');
                return false;
            }
            throw error;
        }

        console.log('✅ Notes table exists!');

        // Test 2: Check storage bucket
        console.log('\n📦 Testing storage bucket...');
        const { data: buckets, error: bucketError } = await supabase
            .storage
            .listBuckets();

        if (bucketError) throw bucketError;

        const notesBucket = buckets.find(b => b.name === 'notes-files');
        if (notesBucket) {
            console.log('✅ Storage bucket "notes-files" exists!');
        } else {
            console.log('❌ Storage bucket "notes-files" does NOT exist');
            console.log('\n📝 Create storage bucket:');
            console.log('1. Go to Storage in Supabase dashboard');
            console.log('2. Create bucket named "notes-files"');
            console.log('3. Make it PUBLIC');
            return false;
        }

        console.log('\n✅ All checks passed! Supabase is ready.');
        return true;

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        return false;
    }
}

testConnection().then(success => {
    process.exit(success ? 0 : 1);
});
