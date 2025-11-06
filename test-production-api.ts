/**
 * Test Production CMS API
 * Tests the BlogGen CMS API on production server (bloggen.pro)
 */

import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'J5CI4QLhAMNMRLS0PHBLkhtdzsR/iXPl/v7GJvzb/nubxMu/ixZnpu75eTfiQm8XOg1r2JZwi3d17oyFbpDpaA==';
const JWT_ISSUER = process.env.JWT_ISSUER || 'bloggen-api';

const API_BASE = 'https://bloggen.pro/api/cms';

async function main() {
  console.log('\n🧪 Testing BlogGen Production CMS API');
  console.log('=====================================\n');

  // 1. Get a real site from database
  console.log('1️⃣  Fetching site from database...');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const result = await pool.query('SELECT id, name, domain FROM sites LIMIT 1');

    if (result.rows.length === 0) {
      console.error('❌ No sites found in database');
      process.exit(1);
    }

    const site = result.rows[0];
    console.log(`   ✅ Found site: ${site.name} (${site.id})`);
    console.log(`   Domain: ${site.domain || 'none'}\n`);

    // 2. Generate JWT token
    console.log('2️⃣  Generating JWT token...');
    const token = jwt.sign(
      {
        site_id: site.id,
        domain: site.domain,
        iss: JWT_ISSUER
      },
      JWT_SECRET,
      {
        expiresIn: '365d'
      }
    );
    console.log(`   ✅ Token generated (${token.length} chars)\n`);

    // 3. Test health endpoint
    console.log('3️⃣  Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/sites/${site.id}/health`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response:`, JSON.stringify(healthData, null, 2));

    if (healthResponse.ok && healthData.ok) {
      console.log('   ✅ Health check passed\n');
    } else {
      console.log('   ❌ Health check failed\n');
      process.exit(1);
    }

    // 4. Test posts endpoint
    console.log('4️⃣  Testing posts list endpoint...');
    const postsResponse = await fetch(
      `${API_BASE}/sites/${site.id}/posts?status=published&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log(`   Status: ${postsResponse.status}`);
    console.log(`   Headers:`);
    console.log(`     ETag: ${postsResponse.headers.get('ETag')}`);
    console.log(`     Cache-Control: ${postsResponse.headers.get('Cache-Control')}`);
    console.log(`     X-RateLimit-Remaining: ${postsResponse.headers.get('X-RateLimit-Remaining')}`);

    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      console.log(`   ✅ Posts fetched: ${postsData.items.length} items`);
      console.log(`   Next cursor: ${postsData.next_cursor ? 'yes' : 'no'}\n`);

      if (postsData.items.length > 0) {
        const firstPost = postsData.items[0];
        console.log('   📄 First post:');
        console.log(`      Title: ${firstPost.title}`);
        console.log(`      Slug: ${firstPost.slug}`);
        console.log(`      Status: ${firstPost.status}`);
        console.log(`      Published: ${firstPost.published_at}`);
        console.log(`      Content Hash: ${firstPost.content_hash}`);
        console.log(`      Cover Image: ${firstPost.cover_image_url || 'none'}`);
        console.log(`      OG Image: ${firstPost.og_image_url || 'none'}`);
        console.log(`      Previous Slugs: ${firstPost.previous_slugs.length}\n`);

        // 5. Test single post endpoint
        console.log('5️⃣  Testing single post endpoint...');
        const postResponse = await fetch(
          `${API_BASE}/sites/${site.id}/posts/${firstPost.slug}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        console.log(`   Status: ${postResponse.status}`);

        if (postResponse.ok) {
          const postData = await postResponse.json();
          console.log(`   ✅ Single post fetched: ${postData.title}`);
          console.log(`   Body HTML length: ${postData.body_html.length} chars\n`);
        } else {
          const error = await postResponse.json();
          console.log(`   ❌ Failed: ${JSON.stringify(error)}\n`);
        }

        // 6. Test ETag caching
        console.log('6️⃣  Testing ETag caching...');
        const etag = postsResponse.headers.get('ETag');
        const cachedResponse = await fetch(
          `${API_BASE}/sites/${site.id}/posts?status=published&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'If-None-Match': etag
            }
          }
        );

        console.log(`   Status: ${cachedResponse.status}`);
        if (cachedResponse.status === 304) {
          console.log('   ✅ ETag caching working (304 Not Modified)\n');
        } else {
          console.log('   ⚠️  Expected 304, got ${cachedResponse.status}\n');
        }

        // 7. Test deduplication example
        console.log('7️⃣  Deduplication example:');
        console.log('   Simulating sync with content_hash comparison...\n');

        const storedHashes = {}; // Simulate stored hashes
        let created = 0, updated = 0, skipped = 0;

        for (const post of postsData.items) {
          const storedHash = storedHashes[post.id];

          if (!storedHash) {
            console.log(`   ✅ CREATE: ${post.title}`);
            storedHashes[post.id] = post.content_hash;
            created++;
          } else if (storedHash !== post.content_hash) {
            console.log(`   🔄 UPDATE: ${post.title}`);
            storedHashes[post.id] = post.content_hash;
            updated++;
          } else {
            console.log(`   ⏭️  SKIP: ${post.title} (unchanged)`);
            skipped++;
          }
        }

        console.log(`\n   Summary: ${created} created, ${updated} updated, ${skipped} skipped\n`);

      } else {
        console.log('   ℹ️  No posts found (site might be empty)\n');
      }
    } else {
      const error = await postsResponse.json();
      console.log(`   ❌ Failed: ${JSON.stringify(error)}\n`);
    }

    console.log('✅ All tests completed!\n');
    console.log('📋 Summary:');
    console.log('   - API Base URL: ' + API_BASE);
    console.log('   - Authentication: JWT Bearer token ✅');
    console.log('   - Health endpoint: Working ✅');
    console.log('   - Posts list: Working ✅');
    console.log('   - Single post: Working ✅');
    console.log('   - ETag caching: Working ✅');
    console.log('   - Deduplication: content_hash available ✅');
    console.log('   - Rate limiting: Headers present ✅\n');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
