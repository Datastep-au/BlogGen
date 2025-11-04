import { config } from 'dotenv';
import { generateSiteJWT } from './dist/lib/apiAuth.js';

// Load environment variables
config();

const siteId = process.argv[2] || 'cb32e8bc-24f3-474a-a1f2-f5c107d9988e';

console.log('\n=== Generating JWT Token ===');
console.log('Site ID:', siteId);

try {
  const token = generateSiteJWT(siteId);

  console.log('Token:', token);
  console.log('\nTest command:');
  console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3005/api/cms/sites/${siteId}/health`);
  console.log('');
} catch (error) {
  console.error('Error generating token:', error);
}
