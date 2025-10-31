import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Storage with Different Auth Methods\n');

// Test 1: Standard client
console.log('📦 Test 1: Standard Supabase Client');
const client1 = createClient(supabaseUrl, supabaseServiceKey);

try {
  const { data, error } = await client1.storage.listBuckets();
  if (error) {
    console.log('❌ Standard client failed:', error.message);
  } else {
    console.log('✅ Standard client works! Buckets:', data?.length || 0);
  }
} catch (e) {
  console.log('❌ Exception:', e.message);
}

// Test 2: Client with auth options
console.log('\n📦 Test 2: Client with auth persistence disabled');
const client2 = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

try {
  const { data, error } = await client2.storage.listBuckets();
  if (error) {
    console.log('❌ Auth-disabled client failed:', error.message);
  } else {
    console.log('✅ Auth-disabled client works! Buckets:', data?.length || 0);
  }
} catch (e) {
  console.log('❌ Exception:', e.message);
}

// Test 3: Direct API call with Authorization header
console.log('\n📦 Test 3: Direct Storage API call');
try {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey
    }
  });

  const result = await response.json();

  if (!response.ok) {
    console.log('❌ Direct API call failed:', response.status, result);
  } else {
    console.log('✅ Direct API call works! Buckets:', result.length || 0);
    result.forEach(bucket => {
      console.log(`   - ${bucket.name}`);
    });
  }
} catch (e) {
  console.log('❌ Exception:', e.message);
}

// Test 4: Check if Storage is enabled
console.log('\n📦 Test 4: Testing Auth API (to verify token works elsewhere)');
try {
  const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey
    }
  });

  if (!response.ok) {
    console.log('❌ Auth health check failed:', response.status);
  } else {
    console.log('✅ Auth API is working (token is valid for Auth)');
  }
} catch (e) {
  console.log('❌ Exception:', e.message);
}

console.log('\n💡 Diagnosis:');
console.log('If Auth API works but Storage API does not, this suggests:');
console.log('1. Storage API might not be enabled in your Supabase project');
console.log('2. Storage API might have different JWT secret configuration');
console.log('3. The service role key might not have storage permissions');
console.log('\n📋 Action items:');
console.log('1. Check Supabase Dashboard > Storage to verify it is enabled');
console.log('2. Try regenerating the service_role key in Dashboard > Settings > API');
console.log('3. Verify Storage API is not disabled in project settings');
