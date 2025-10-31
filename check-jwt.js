import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ override: true });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Checking Supabase JWT Tokens\n');

function decodeJWT(token, name) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log(`❌ ${name}: Invalid JWT format (expected 3 parts, got ${parts.length})`);
      return;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    console.log(`✅ ${name}:`);
    console.log(`   - Issuer: ${payload.iss}`);
    console.log(`   - Role: ${payload.role}`);
    console.log(`   - Project Ref: ${payload.ref}`);
    console.log(`   - Issued At: ${new Date(payload.iat * 1000).toISOString()}`);
    console.log(`   - Expires At: ${new Date(payload.exp * 1000).toISOString()}`);

    const now = Date.now() / 1000;
    if (payload.exp < now) {
      console.log(`   ⚠️  TOKEN EXPIRED! (expired ${Math.floor((now - payload.exp) / 86400)} days ago)`);
    } else {
      console.log(`   ✅ Token is valid (expires in ${Math.floor((payload.exp - now) / 86400)} days)`);
    }

    return payload;
  } catch (error) {
    console.log(`❌ ${name}: Failed to decode - ${error.message}`);
  }
}

console.log('Service Role Key:');
const servicePayload = decodeJWT(serviceKey, 'SERVICE_ROLE_KEY');

console.log('\nAnon Key:');
const anonPayload = decodeJWT(anonKey, 'ANON_KEY');

console.log('\n📊 Summary:');
if (servicePayload && anonPayload) {
  if (servicePayload.ref !== anonPayload.ref) {
    console.log('⚠️  WARNING: Service and Anon keys are for DIFFERENT projects!');
    console.log(`   Service: ${servicePayload.ref}`);
    console.log(`   Anon: ${anonPayload.ref}`);
  } else {
    console.log('✅ Both keys are for the same project:', servicePayload.ref);
  }

  if (servicePayload.role !== 'service_role') {
    console.log('❌ Service key does not have service_role role!');
  } else {
    console.log('✅ Service key has correct role');
  }
}

console.log('\n💡 To get the correct keys:');
console.log('1. Go to https://supabase.com/dashboard/project/ajpkqayllmdzytrcgiwg/settings/api');
console.log('2. Copy the "service_role" key (NOT the anon key)');
console.log('3. Update SUPABASE_SERVICE_ROLE_KEY in .env file');
