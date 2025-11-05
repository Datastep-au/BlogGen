# BlogGen CMS API - Quick Start Guide

Get started with the BlogGen headless CMS API in 5 minutes.

## Prerequisites

- Your Site ID (UUID)
- Your API Token (JWT)
- A website or application that can make HTTP requests

## Step 1: Get Your Credentials

Contact your BlogGen administrator to obtain:
1. **Site ID**: A UUID like `a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6`
2. **API Token**: A JWT token that starts with `eyJ...`

## Step 2: Test Your Connection

```bash
# Replace YOUR_SITE_ID and YOUR_TOKEN with your actual credentials
curl -X GET "https://your-bloggen-api.com/api/cms/sites/YOUR_SITE_ID/health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "ok": true,
  "time": "2025-11-05T12:34:56.789Z"
}
```

## Step 3: Fetch Your First Posts

```bash
curl -X GET "https://your-bloggen-api.com/api/cms/sites/YOUR_SITE_ID/posts?status=published&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response Structure:**
```json
{
  "items": [
    {
      "id": "post-uuid",
      "title": "Your First Blog Post",
      "slug": "your-first-blog-post",
      "body_html": "<p>Content goes here...</p>",
      "cover_image_url": "https://...",
      "og_image_url": "https://...",
      "published_at": "2025-11-01T10:00:00Z",
      "content_hash": "hash-for-deduplication"
    }
  ],
  "next_cursor": "base64-encoded-cursor-or-null",
  "last_sync": "2025-11-05T12:34:56.789Z"
}
```

## Step 4: Implement in Your Code

### JavaScript/TypeScript

```typescript
const SITE_ID = 'your-site-id';
const API_TOKEN = 'your-api-token';
const API_BASE = 'https://your-bloggen-api.com/api/cms';

async function fetchPosts() {
  const response = await fetch(
    `${API_BASE}/sites/${SITE_ID}/posts?status=published`,
    {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items;
}

// Use it
fetchPosts()
  .then(posts => {
    posts.forEach(post => {
      console.log(`${post.title} - ${post.slug}`);
    });
  })
  .catch(error => console.error('Error:', error));
```

### PHP

```php
<?php
$siteId = 'your-site-id';
$apiToken = 'your-api-token';
$apiBase = 'https://your-bloggen-api.com/api/cms';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "$apiBase/sites/$siteId/posts?status=published");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $apiToken"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    foreach ($data['items'] as $post) {
        echo $post['title'] . " - " . $post['slug'] . "\n";
    }
} else {
    echo "Error: HTTP $httpCode\n";
}
?>
```

### Python

```python
import requests

SITE_ID = 'your-site-id'
API_TOKEN = 'your-api-token'
API_BASE = 'https://your-bloggen-api.com/api/cms'

def fetch_posts():
    response = requests.get(
        f'{API_BASE}/sites/{SITE_ID}/posts',
        headers={'Authorization': f'Bearer {API_TOKEN}'},
        params={'status': 'published'}
    )

    response.raise_for_status()
    data = response.json()
    return data['items']

# Use it
posts = fetch_posts()
for post in posts:
    print(f"{post['title']} - {post['slug']}")
```

## Step 5: Avoid Duplicate Imports

**Store the `content_hash`** for each post you import. On subsequent syncs, compare the incoming `content_hash` with your stored value:

```typescript
// Pseudocode
const storedPosts = database.getAllPosts(); // { id: content_hash }

fetchPosts().then(incomingPosts => {
  incomingPosts.forEach(post => {
    const stored = storedPosts[post.id];

    if (!stored) {
      // New post - import it
      database.createPost(post);
    } else if (stored.content_hash !== post.content_hash) {
      // Post changed - update it
      database.updatePost(post.id, post);
    } else {
      // No changes - skip
      console.log(`Skipping unchanged post: ${post.title}`);
    }
  });
});
```

## Common Use Cases

### Fetch Only Recent Posts

```bash
# Get posts updated since a specific date
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts?updated_since=2025-11-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pagination

```bash
# First page
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Next page (use cursor from previous response)
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts?limit=50&cursor=BASE64_CURSOR" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Single Post by Slug

```bash
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts/your-post-slug" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limits

- **Limit**: 60 requests per minute per site
- **Headers**: Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` in responses
- **Best Practice**: Implement exponential backoff on 429 errors

## Error Handling

```typescript
async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

## Next Steps

- **Full API Documentation**: See [CMS_API_INTEGRATION.md](./CMS_API_INTEGRATION.md) for complete API reference
- **Deduplication Guide**: See [DEDUPLICATION_GUIDE.md](./DEDUPLICATION_GUIDE.md) for advanced sync strategies
- **Example Implementation**: See [examples/sync-client-example.ts](./examples/sync-client-example.ts) for production-ready code

## Troubleshooting

### 401 Unauthorized
- Verify your API token is correct
- Check that the token hasn't expired (tokens last 365 days)
- Ensure you're using the correct Site ID

### 403 Forbidden
- The Site ID in the URL must match the Site ID in your token
- Your site may be marked as inactive

### 429 Too Many Requests
- You've exceeded 60 requests per minute
- Implement rate limiting in your code
- Use the `Retry-After` header value

### Empty Response
- Check the `status` parameter (default is 'published')
- Verify posts exist in your BlogGen CMS
- Try removing query parameters to fetch all posts

## Support

For additional help:
- Review the full documentation in this `docs/` folder
- Contact your BlogGen administrator
- Check server logs for detailed error messages
