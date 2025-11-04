import { config } from 'dotenv';
import jwt from 'jsonwebtoken';

config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'bloggen-api';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaXRlX2lkIjoiY2IzMmU4YmMtMjRmMy00NzRhLWExZjItZjVjMTA3ZDk5ODhlIiwiaXNzIjoiYmxvZ2dlbi1hcGkiLCJpYXQiOjE3NjIyNTE1NjAsImV4cCI6MTc5Mzc4NzU2MH0.KkuTGAJ9oc6kKsSOawMm-aLCJlGosYHyyMWE8j4_g6w';

console.log('JWT_SECRET:', JWT_SECRET);
console.log('JWT_ISSUER:', JWT_ISSUER);
console.log('\nTrying to verify...');

try {
  const payload = jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER
  });
  console.log('✅ Verification successful!');
  console.log('Payload:', payload);
} catch (error) {
  console.error('❌ Verification failed:',error);
}
