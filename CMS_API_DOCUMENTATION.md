# BlogGen Headless CMS API Documentation

## Overview

BlogGen provides a comprehensive headless CMS API for multi-tenant content delivery with webhook support, scheduled publishing, and asset management. The system includes two distinct API surfaces:

1. **Admin API** - Protected endpoints for managing sites, posts, and webhooks (requires Supabase Auth)
2. **Public CMS API** - Read-only endpoints for client sites to consume content (requires API Key Auth)

## Authentication

### Admin Authentication (Supabase Auth)

All admin endpoints require a valid Supabase JWT token in the Authorization header:

```http
Authorization: Bearer <supabase-jwt-token>
```

### Client Authentication (API Key)

Client sites authenticate using API keys to receive JWT tokens:

```http
POST /api/auth/token
Content-Type: application/json

{
  "api_key": "your-api-key-here"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "site_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

Use the returned JWT token for all subsequent CMS API requests:

```http
Authorization: Bearer <jwt-token>
```

---

## Admin API Endpoints

### Site Management

#### Create Site
```http
POST /api/admin/sites
Content-Type: application/json
Authorization: Bearer <supabase-jwt>

{
  "name": "My Blog",
  "domain": "myblog.com"
}
```

**Response:**
```json
{
  "site": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Blog",
    "domain": "myblog.com",
    "created_at": "2025-10-17T03:00:00.000Z"
  },
  "api_key": "sk_live_abc123def456...",
  "message": "Site created successfully. Save your API key - it won't be shown again!"
}
```

⚠️ **Important**: The API key is only shown once during creation. Store it securely.

#### List Sites
```http
GET /api/admin/sites
Authorization: Bearer <supabase-jwt>
```

**Response:**
```json
{
  "sites": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "My Blog",
      "domain": "myblog.com",
      "created_at": "2025-10-17T03:00:00.000Z"
    }
  ]
}
```

#### Rotate API Key
```http
POST /api/admin/sites/:siteId/rotate-key
Authorization: Bearer <supabase-jwt>
```

**Response:**
```json
{
  "site": { ... },
  "new_api_key": "sk_live_xyz789...",
  "message": "API key rotated successfully. Update your client applications!"
}
```

### Webhook Management

#### Create Webhook
```http
POST /api/admin/webhooks
Content-Type: application/json
Authorization: Bearer <supabase-jwt>

{
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "url": "https://mysite.com/webhooks/posts",
  "events": ["post_published", "post_updated"]
}
```

**Response:**
```json
{
  "webhook": {
    "id": 1,
    "site_id": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://mysite.com/webhooks/posts",
    "events": ["post_published", "post_updated"],
    "is_active": true,
    "created_at": "2025-10-17T03:00:00.000Z"
  },
  "secret": "whsec_abc123def456...",
  "message": "Webhook created. Use the secret to verify webhook signatures."
}
```

#### List Webhooks for Site
```http
GET /api/admin/webhooks/site/:siteId
Authorization: Bearer <supabase-jwt>
```

#### Delete Webhook
```http
DELETE /api/admin/webhooks/:webhookId
Authorization: Bearer <supabase-jwt>
```

### Post Management

#### Publish Article to CMS
```http
POST /api/admin/posts/publish
Content-Type: application/json
Authorization: Bearer <supabase-jwt>

{
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "article_id": 42,
  "status": "published",
  "scheduled_date": null
}
```

**Status Options:**
- `"draft"` - Save as draft (not visible on public API)
- `"published"` - Publish immediately
- `"scheduled"` - Schedule for future publish (requires `scheduled_date`)

**Response:**
```json
{
  "success": true,
  "post": {
    "id": 1,
    "site_id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "How to Build a Headless CMS",
    "slug": "how-to-build-headless-cms",
    "excerpt": "Learn how to build a modern headless CMS...",
    "body_html": "<p>Content here...</p>",
    "tags": ["cms", "tutorial"],
    "status": "published",
    "published_at": "2025-10-17T03:00:00.000Z",
    "content_hash": "a1b2c3d4e5f6...",
    "created_at": "2025-10-17T03:00:00.000Z",
    "updated_at": "2025-10-17T03:00:00.000Z"
  },
  "message": "Post published successfully"
}
```

#### Update Post
```http
PUT /api/admin/posts/:postId
Content-Type: application/json
Authorization: Bearer <supabase-jwt>

{
  "title": "Updated Title",
  "body_md": "# New content\n\nUpdated markdown...",
  "tags": ["cms", "updated"]
}
```

#### Delete Post
```http
DELETE /api/admin/posts/:postId
Authorization: Bearer <supabase-jwt>
```

#### List Posts for Site
```http
GET /api/admin/posts/site/:siteId?status=published&limit=50&cursor=abc123
Authorization: Bearer <supabase-jwt>
```

**Query Parameters:**
- `status` - Filter by status (draft/published/scheduled)
- `limit` - Number of posts per page (default: 50)
- `cursor` - Pagination cursor from previous response

---

## Public CMS API Endpoints

### List Posts

```http
GET /v1/sites/:site_id/posts?status=published&limit=20&cursor=xyz
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `status` - Filter by status (default: published)
- `tags` - Comma-separated tags to filter
- `since` - ISO 8601 date to get posts updated since
- `limit` - Posts per page (default: 20, max: 100)
- `cursor` - Pagination cursor from previous response

**Response:**
```json
{
  "posts": [
    {
      "id": 1,
      "site_id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "How to Build a Headless CMS",
      "slug": "how-to-build-headless-cms",
      "excerpt": "Learn how to build a modern headless CMS...",
      "body_html": "<p>Full content...</p>",
      "tags": ["cms", "tutorial"],
      "cover_image_url": "https://...",
      "meta_title": "How to Build a Headless CMS - Complete Guide",
      "meta_description": "Step-by-step tutorial...",
      "og_image_url": "https://...",
      "canonical_url": "https://myblog.com/blog/how-to-build-headless-cms",
      "published_at": "2025-10-17T03:00:00.000Z",
      "updated_at": "2025-10-17T03:00:00.000Z"
    }
  ],
  "next_cursor": "eyJ1cGRhdGVkX2F0IjoiMjAyNS0xMC0xN1QwMzowMDowMC4wMDBaIn0="
}
```

**Response Headers:**
- `ETag` - Content hash for caching
- `Cache-Control: public, max-age=300` - 5-minute cache

### Get Single Post

```http
GET /v1/sites/:site_id/posts/:slug
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": 1,
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How to Build a Headless CMS",
  "slug": "how-to-build-headless-cms",
  "body_html": "<p>Full content...</p>",
  ...
}
```

**301 Redirect Support:**
If the slug has changed, the API returns a 301 redirect with `Location` header pointing to the new slug.

---

## Webhook Events

When posts are published, updated, or deleted, webhooks are triggered to subscribed endpoints.

### Event Types

1. **post_published** - New post published
2. **post_updated** - Existing post updated
3. **post_deleted** - Post deleted

### Webhook Payload

```http
POST https://your-site.com/webhooks/posts
Content-Type: application/json
X-Webhook-Signature: sha256=abc123def456...

{
  "event": "post_published",
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "post_id": 1,
  "slug": "how-to-build-headless-cms",
  "updated_at": "2025-10-17T03:00:00.000Z",
  "content_hash": "a1b2c3d4e5f6..."
}
```

### Verifying Webhook Signatures

Webhooks are signed using HMAC-SHA256. Verify the signature to ensure authenticity:

**Node.js Example:**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Usage
app.post('/webhooks/posts', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, 'whsec_...');
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Event:', req.body.event);
  res.json({ received: true });
});
```

### Webhook Delivery & Retries

- **Delivery**: HTTP POST with JSON payload
- **Timeout**: 10 seconds
- **Retry Logic**: 3 attempts with exponential backoff
  - Attempt 1: Immediate
  - Attempt 2: After 1 minute
  - Attempt 3: After 5 minutes
  - Attempt 4: After 15 minutes
- **Success**: HTTP 2xx response
- **Failure**: Any non-2xx response or timeout

All delivery attempts are logged with status codes and error messages for debugging.

---

## Scheduled Publishing

Posts can be scheduled for future publication by setting a `scheduled_date` when publishing:

```json
{
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "article_id": 42,
  "status": "scheduled",
  "scheduled_date": "2025-10-20T10:00:00.000Z"
}
```

**How It Works:**
1. Post is created with `status: "scheduled"`
2. Scheduled job is queued in the database
3. Job processor checks every 60 seconds for due posts
4. When `scheduled_date` is reached:
   - Post status changes to `"published"`
   - `published_at` is set to current time
   - Webhook events are emitted

---

## Content Hashing & Change Detection

Every post has a `content_hash` (UUIDv5) generated from:
- Site ID
- Slug
- Title
- Body (markdown)
- Meta title
- Meta description
- Tags

**Use Cases:**
- **ETags**: Efficient HTTP caching
- **Change Detection**: Detect content changes between API calls
- **Webhook Filtering**: Only process posts that have changed

---

## Rate Limiting

- **Admin API**: No rate limit (protected by Supabase Auth)
- **Public API**: 100 requests per minute per API key
- **Webhook Delivery**: 3 retries max per event

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate slug)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Example Integration

### Full Client Site Integration

```javascript
// 1. Authenticate and get token
const authResponse = await fetch('https://bloggen.replit.app/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: 'sk_live_...' })
});
const { token, site_id } = await authResponse.json();

// 2. Fetch posts
const postsResponse = await fetch(
  `https://bloggen.replit.app/v1/sites/${site_id}/posts?limit=10`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const { posts, next_cursor } = await postsResponse.json();

// 3. Display posts
posts.forEach(post => {
  console.log(`${post.title} - ${post.slug}`);
});

// 4. Set up webhook endpoint
app.post('/webhooks/posts', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  if (!verifyWebhookSignature(req.body, signature, 'whsec_...')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  if (req.body.event === 'post_published') {
    // Invalidate cache, rebuild static pages, etc.
    console.log('New post:', req.body.slug);
  }
  
  res.json({ received: true });
});
```

---

## Best Practices

1. **Caching**: Use ETag headers for efficient caching
2. **Webhooks**: Always verify HMAC signatures
3. **Pagination**: Use cursors for consistent pagination
4. **API Keys**: Rotate keys periodically for security
5. **Error Handling**: Handle rate limits and retries gracefully
6. **Content Sync**: Use content_hash to detect changes
7. **Scheduled Posts**: Schedule during off-peak hours

---

## Support

For issues or questions:
- Check the main README for architecture details
- Review the replit.md for system overview
- Inspect webhook delivery logs in admin dashboard
