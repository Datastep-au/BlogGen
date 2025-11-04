import { config } from 'dotenv';
import { generateSiteJWT } from './server/lib/apiAuth';

// Load environment variables
config();

const siteId = process.argv[2] || 'cb32e8bc-24f3-474a-a1f2-f5c107d9988e';

console.log('\n=== Generating JWT Token ===');
console.log('Site ID:', siteId);
console.log('JWT_SECRET:', process.env.JWT_SECRET?.substring(0, 20) + '...');
console.log('JWT_ISSUER:', process.env.JWT_ISSUER);

try {
  const token = generateSiteJWT(siteId);

  console.log('\nToken:', token);
  console.log('\nTest command:');
  console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3005/api/cms/sites/${siteId}/health`);
  console.log('\nTest posts:');
  console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3005/api/cms/sites/${siteId}/posts`);
  console.log('');
} catch (error) {
  console.error('Error generating token:', error);
}
