import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Storage Configuration\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Key (first 20 chars):', supabaseServiceKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testStorage() {
  try {
    console.log('\n📦 Test 1: List existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Failed to list buckets:', listError);
      return false;
    }

    console.log('✅ Successfully listed buckets:');
    if (buckets && buckets.length > 0) {
      buckets.forEach(bucket => {
        console.log(`   - ${bucket.name} (public: ${bucket.public}, created: ${bucket.created_at})`);
      });
    } else {
      console.log('   No buckets found');
    }

    console.log('\n📦 Test 2: Check if bloggen-assets bucket exists...');
    const bloggenBucket = buckets?.find(b => b.name === 'bloggen-assets');
    if (bloggenBucket) {
      console.log('✅ bloggen-assets bucket exists');
    } else {
      console.log('⚠️  bloggen-assets bucket does not exist, attempting to create...');

      const { data: newBucket, error: createError } = await supabase.storage.createBucket('bloggen-assets', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });

      if (createError) {
        console.error('❌ Failed to create bucket:', createError);
      } else {
        console.log('✅ Successfully created bloggen-assets bucket');
      }
    }

    console.log('\n📦 Test 3: Test site-specific bucket creation...');
    const testSiteId = 'test-' + Date.now();
    const testBucketName = `site-${testSiteId}`;

    const { data: siteBucket, error: siteError } = await supabase.storage.createBucket(testBucketName, {
      public: true,
      fileSizeLimit: 10485760,
    });

    if (siteError) {
      console.error('❌ Failed to create site bucket:', siteError);
    } else {
      console.log(`✅ Successfully created site bucket: ${testBucketName}`);

      // Clean up test bucket
      console.log('🧹 Cleaning up test bucket...');
      const { error: deleteError } = await supabase.storage.deleteBucket(testBucketName);
      if (deleteError) {
        console.error('⚠️  Failed to delete test bucket:', deleteError);
      } else {
        console.log('✅ Test bucket deleted');
      }
    }

    console.log('\n📦 Test 4: Test upload to bloggen-assets bucket...');
    const testContent = Buffer.from('Test image content');
    const testPath = `test/${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bloggen-assets')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
      });

    if (uploadError) {
      console.error('❌ Failed to upload test file:', uploadError);
    } else {
      console.log('✅ Successfully uploaded test file:', uploadData.path);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('bloggen-assets')
        .getPublicUrl(testPath);

      console.log('✅ Public URL:', urlData.publicUrl);

      // Clean up test file
      console.log('🧹 Cleaning up test file...');
      const { error: deleteFileError } = await supabase.storage
        .from('bloggen-assets')
        .remove([testPath]);

      if (deleteFileError) {
        console.error('⚠️  Failed to delete test file:', deleteFileError);
      } else {
        console.log('✅ Test file deleted');
      }
    }

    console.log('\n✅ All storage tests completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Storage test failed with exception:', error);
    return false;
  }
}

testStorage()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
