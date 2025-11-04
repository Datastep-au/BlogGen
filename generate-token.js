import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'bloggen-api';

// Get site ID from command line argument
const siteId = process.argv[2];

if (!siteId) {
  console.error('Usage: node generate-token.js <site-id>');
  process.exit(1);
}

const payload = {
  site_id: siteId,
  iss: JWT_ISSUER,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
};

const token = jwt.sign(payload, JWT_SECRET);

console.log('\n=== JWT Token Generated ===');
console.log('Site ID:', siteId);
console.log('Token:', token);
console.log('\nUse this token in your API requests:');
console.log(`Authorization: Bearer ${token}`);
console.log('\nExample curl command:');
console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3005/api/cms/sites/${siteId}/posts`);
console.log('');
