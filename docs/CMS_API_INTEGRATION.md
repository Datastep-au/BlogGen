# BlogGen CMS API - Complete Integration Guide

Complete reference documentation for integrating with the BlogGen headless CMS API.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Security](#security)

---

## Overview

The BlogGen CMS API is a RESTful JSON API that provides programmatic access to your blog posts. It's designed for:

- **Headless CMS Integration**: Fetch content for any frontend framework
- **Multi-site Support**: Each site has isolated content and authentication
- **Efficient Syncing**: Built-in deduplication and incremental sync capabilities
- **Production-Ready**: Rate limiting, caching, and comprehensive error handling

**Base URL**: `https://your-bloggen-api.com/api/cms`

**API Version**: All endpoints are currently v1 (no version prefix required)

---

## Authentication

### JWT Bearer Token

All API requests require a JWT (JSON Web Token) passed in the `Authorization` header.

**Header Format:**
```
Authorization: Bearer <JWT_TOKEN>
```

### Token Structure

Tokens are signed JWTs containing:
```json
{
  "site_id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "domain": "yourblog.com",
  "iss": "bloggen-api",
  "iat": 1699200000,
  "exp": 1730736000
}
```

- **site_id**: Your unique site identifier (UUID)
- **domain**: Your site's domain (optional)
- **iss**: Issuer (always `bloggen-api`)
- **iat**: Issued at timestamp
- **exp**: Expiration timestamp (365 days from issue)

### Obtaining a Token

Contact your BlogGen administrator to generate an API token for your site.

### Token Security

- **Never expose tokens in client-side code** or public repositories
- Store tokens as environment variables
- Rotate tokens annually (before expiration)
- Use separate tokens for development and production

### Authentication Errors

| Status Code | Error | Cause |
|-------------|-------|-------|
| 401 | `Unauthorized` | Missing or malformed Authorization header |
| 401 | `Invalid or expired token` | Token signature invalid or expired |
| 403 | `Access denied` | Site ID in URL doesn't match token |
| 401 | `Site not found or inactive` | Site doesn't exist or is disabled |

---

## Rate Limiting

To ensure fair usage and API stability, all requests are rate-limited.

### Limits

- **60 requests per minute** per site
- Keyed by `site_id` from your JWT token

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-11-05T12:45:00.000Z
```

- **X-RateLimit-Limit**: Maximum requests allowed in the window
- **X-RateLimit-Remaining**: Requests remaining in current window
- **X-RateLimit-Reset**: ISO 8601 timestamp when the limit resets

### 429 Response

When rate limit is exceeded:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 45
}
```

**Headers:**
```http
Retry-After: 45
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-11-05T12:45:00.000Z
```

### Handling Rate Limits

```typescript
async function fetchWithRateLimit(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.log(`Rate limited. Retrying after ${retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return fetchWithRateLimit(url); // Retry
  }

  return response.json();
}
```

---

## API Endpoints

### 1. Health Check

Check API connectivity and authentication.

**Endpoint:** `GET /sites/:siteId/health`

**Parameters:**
- `siteId` (path): Your site UUID

**Example Request:**
```bash
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "time": "2025-11-05T12:34:56.789Z"
}
```

**Use Cases:**
- Test authentication before starting a sync
- Monitor API availability
- Validate site configuration

---

### 2. List Posts

Fetch a paginated list of posts for your site.

**Endpoint:** `GET /sites/:siteId/posts`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `siteId` | path | Yes | - | Your site UUID |
| `status` | query | No | `published` | Filter by status: `draft`, `published`, `scheduled`, `archived` |
| `updated_since` | query | No | - | ISO 8601 timestamp. Only return posts updated after this time |
| `limit` | query | No | `50` | Number of results per page (1-100) |
| `cursor` | query | No | - | Base64-encoded pagination cursor for next page |

**Example Request:**
```bash
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts?status=published&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example with Incremental Sync:**
```bash
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts?updated_since=2025-11-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "site_id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "title": "Getting Started with BlogGen",
      "slug": "getting-started-with-bloggen",
      "excerpt": "Learn how to use BlogGen CMS to power your blog.",
      "body_html": "<p>BlogGen is a powerful headless CMS...</p>",
      "tags": ["tutorial", "getting-started"],
      "cover_image_url": "https://cdn.example.com/images/cover.jpg",
      "meta_title": "Getting Started with BlogGen - Complete Guide",
      "meta_description": "Learn how to use BlogGen CMS to power your blog with this complete guide.",
      "og_image_url": "https://cdn.example.com/images/og-image.jpg",
      "canonical_url": "https://yourblog.com/blog/getting-started-with-bloggen",
      "noindex": false,
      "status": "published",
      "published_at": "2025-11-01T10:00:00.000Z",
      "updated_at": "2025-11-02T15:30:00.000Z",
      "previous_slugs": ["getting-started"],
      "content_hash": "b3f4a5c6-d7e8-f9g0-h1i2-j3k4l5m6n7o8"
    }
  ],
  "next_cursor": "eyJ1cGRhdGVkX2F0IjoiMjAyNS0xMS0wMlQxNTozMDowMC4wMDBaIiwiaWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ==",
  "last_sync": "2025-11-05T12:34:56.789Z"
}
```

**Response Headers:**
```http
ETag: "a3f8d92c1e5b7a6f4d2c9b1e8a5c7d3f"
Cache-Control: public, max-age=60
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `items` | Array | Array of post objects (see Post Object schema below) |
| `next_cursor` | String\|null | Base64 cursor for next page, `null` if no more pages |
| `last_sync` | String | ISO 8601 timestamp of this response |

**Pagination Example:**
```typescript
async function fetchAllPosts(siteId: string): Promise<Post[]> {
  let allPosts: Post[] = [];
  let cursor: string | null = null;

  do {
    const url = cursor
      ? `/sites/${siteId}/posts?cursor=${cursor}`
      : `/sites/${siteId}/posts`;

    const response = await fetch(url, { /* ... */ });
    const data = await response.json();

    allPosts = [...allPosts, ...data.items];
    cursor = data.next_cursor;
  } while (cursor);

  return allPosts;
}
```

**Caching with ETag:**
```typescript
let cachedETag: string | null = null;

async function fetchPostsWithCache(url: string) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_TOKEN}`
  };

  if (cachedETag) {
    headers['If-None-Match'] = cachedETag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    console.log('Content not modified, using cache');
    return null; // Use your cached data
  }

  cachedETag = response.headers.get('ETag');
  return response.json();
}
```

---

### 3. Get Single Post by Slug

Fetch a specific post by its URL slug.

**Endpoint:** `GET /sites/:siteId/posts/:slug`

**Parameters:**
- `siteId` (path): Your site UUID
- `slug` (path): The post's URL slug

**Example Request:**
```bash
curl -X GET "https://your-api.com/api/cms/sites/YOUR_SITE_ID/posts/getting-started-with-bloggen" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "site_id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "title": "Getting Started with BlogGen",
  "slug": "getting-started-with-bloggen",
  "excerpt": "Learn how to use BlogGen CMS to power your blog.",
  "body_html": "<p>BlogGen is a powerful headless CMS...</p>",
  "tags": ["tutorial", "getting-started"],
  "cover_image_url": "https://cdn.example.com/images/cover.jpg",
  "meta_title": "Getting Started with BlogGen - Complete Guide",
  "meta_description": "Learn how to use BlogGen CMS to power your blog.",
  "og_image_url": "https://cdn.example.com/images/og-image.jpg",
  "canonical_url": "https://yourblog.com/blog/getting-started-with-bloggen",
  "noindex": false,
  "status": "published",
  "published_at": "2025-11-01T10:00:00.000Z",
  "updated_at": "2025-11-02T15:30:00.000Z",
  "previous_slugs": ["getting-started"],
  "content_hash": "b3f4a5c6-d7e8-f9g0-h1i2-j3k4l5m6n7o8"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Post not found"
}
```

**Use Cases:**
- Direct post lookup by slug
- 404 handling with old slug redirects (check `previous_slugs`)
- Single post updates/refreshes

**Handling Slug Changes:**
```typescript
async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const response = await fetch(
      `/sites/${SITE_ID}/posts/${slug}`,
      { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
    );

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 404) {
      // Post might have been renamed - search by old slug
      const allPosts = await fetchAllPosts();
      return allPosts.find(p => p.previous_slugs.includes(slug)) || null;
    }

    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}
```

---

## Response Formats

### Post Object Schema

```typescript
interface Post {
  id: string;                       // UUID
  site_id: string;                  // UUID
  title: string;                    // Post title
  slug: string;                     // URL-friendly slug (unique per site)
  excerpt: string | null;           // Short description/summary
  body_html: string;                // Full HTML content (rendered from Markdown)
  tags: string[];                   // Array of tag strings
  cover_image_url: string | null;   // Cover/thumbnail image URL
  meta_title: string | null;        // SEO meta title
  meta_description: string | null;  // SEO meta description
  og_image_url: string | null;      // Open Graph image URL
  canonical_url: string | null;     // Canonical URL for SEO
  noindex: boolean;                 // If true, robots should not index
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  published_at: string | null;      // ISO 8601 timestamp or null
  updated_at: string;               // ISO 8601 timestamp
  previous_slugs: string[];         // Array of old slugs (for redirects)
  content_hash: string;             // UUID - deterministic content hash
}
```

### Field Descriptions

**id**: Unique identifier for the post. Use this for all internal references.

**slug**: URL-friendly identifier. Use this for public URLs. Example: `getting-started-with-bloggen`

**excerpt**: Optional short summary. Use for post previews, meta descriptions, or listing pages.

**body_html**: Full post content in HTML format. Safe to render directly (already sanitized).

**tags**: Array of tags. Use for filtering, categorization, and navigation.

**cover_image_url**: Primary image for the post. Use in listings and social shares. May be null.

**og_image_url**: Open Graph image for social media. Use in `<meta property="og:image">`. Falls back to cover_image_url.

**canonical_url**: Canonical URL for SEO. Use in `<link rel="canonical">` tag.

**noindex**: If `true`, add `<meta name="robots" content="noindex">` to prevent search indexing.

**status**: Publication status:
- `draft`: Not yet published
- `published`: Publicly visible
- `scheduled`: Scheduled for future publication
- `archived`: Hidden/archived

**published_at**: When the post was published. Use for sorting by date. May be null for drafts.

**updated_at**: Last modification time. Use for incremental sync with `updated_since` parameter.

**previous_slugs**: Array of historical slugs. Use to set up 301 redirects when slugs change.

**content_hash**: Deterministic hash of post content. **Use this for deduplication** - if the hash matches your stored version, the content hasn't changed.

---

## Error Handling

### Error Response Format

All errors return JSON with consistent structure:

```json
{
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | Request successful |
| 304 | Not Modified | Content unchanged (ETag match) |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Authentication failed |
| 403 | Forbidden | Access denied to resource |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Errors

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```
**Fix**: Check your Authorization header format and token.

#### 403 Access Denied
```json
{
  "error": "Access denied"
}
```
**Fix**: Ensure the Site ID in the URL matches your token's `site_id`.

#### 404 Post Not Found
```json
{
  "error": "Post not found"
}
```
**Fix**: Verify the slug exists. Check `previous_slugs` for renamed posts.

#### 429 Rate Limited
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 45
}
```
**Fix**: Wait `retryAfter` seconds before retrying. Implement exponential backoff.

### Error Handling Best Practices

```typescript
async function apiRequest(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      });

      // Success
      if (response.ok) {
        return await response.json();
      }

      // Not modified (cached)
      if (response.status === 304) {
        return null;
      }

      // Rate limited - wait and retry
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60'
        );
        console.log(`Rate limited. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      // Client error (4xx) - don't retry
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json();
        throw new Error(`API Error ${response.status}: ${error.message}`);
      }

      // Server error (5xx) - retry with backoff
      if (response.status >= 500) {
        if (attempt < retries - 1) {
          const backoff = Math.pow(2, attempt) * 1000;
          console.log(`Server error. Retrying in ${backoff}ms...`);
          await sleep(backoff);
          continue;
        }
        throw new Error(`Server error ${response.status} after ${retries} attempts`);
      }

    } catch (error) {
      if (attempt === retries - 1) throw error;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Best Practices

### 1. Use Incremental Sync

Don't fetch all posts on every sync. Use `updated_since` to fetch only changed posts:

```typescript
const lastSyncTime = await getLastSyncTime();
const response = await fetch(
  `/sites/${SITE_ID}/posts?updated_since=${lastSyncTime.toISOString()}`
);
```

### 2. Implement Content Hash Deduplication

Store `content_hash` locally and compare before updating:

```typescript
async function syncPosts() {
  const incomingPosts = await fetchAllPosts();
  const storedHashes = await getStoredContentHashes();

  for (const post of incomingPosts) {
    const storedHash = storedHashes[post.id];

    if (!storedHash) {
      await createPost(post); // New post
    } else if (storedHash !== post.content_hash) {
      await updatePost(post); // Changed post
    } else {
      console.log(`Skipping unchanged: ${post.title}`);
    }
  }
}
```

### 3. Handle Pagination Properly

Always fetch all pages when syncing:

```typescript
async function fetchAllPages() {
  let allItems = [];
  let cursor = null;

  do {
    const data = await fetchPage(cursor);
    allItems = [...allItems, ...data.items];
    cursor = data.next_cursor;
  } while (cursor);

  return allItems;
}
```

### 4. Set Up 301 Redirects

Use `previous_slugs` to maintain SEO when slugs change:

```typescript
async function setupRedirects() {
  const posts = await fetchAllPosts();

  for (const post of posts) {
    for (const oldSlug of post.previous_slugs) {
      if (oldSlug !== post.slug) {
        // Set up 301 redirect: /blog/{oldSlug} -> /blog/{post.slug}
        await createRedirect(oldSlug, post.slug, 301);
      }
    }
  }
}
```

### 5. Respect Rate Limits

Implement rate limiting awareness:

```typescript
class RateLimitedClient {
  private remaining = 60;
  private resetTime: Date | null = null;

  async request(url: string) {
    // Wait if rate limited
    if (this.remaining === 0 && this.resetTime) {
      const waitMs = this.resetTime.getTime() - Date.now();
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }

    const response = await fetch(url, { /* ... */ });

    // Update rate limit state
    this.remaining = parseInt(
      response.headers.get('X-RateLimit-Remaining') || '60'
    );
    const resetHeader = response.headers.get('X-RateLimit-Reset');
    this.resetTime = resetHeader ? new Date(resetHeader) : null;

    return response;
  }
}
```

### 6. Use ETag Caching

Leverage ETags to reduce bandwidth:

```typescript
const cache = new Map<string, { etag: string; data: any }>();

async function fetchWithCache(url: string) {
  const cached = cache.get(url);
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_TOKEN}`
  };

  if (cached) {
    headers['If-None-Match'] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    return cached!.data;
  }

  const data = await response.json();
  const etag = response.headers.get('ETag');

  if (etag) {
    cache.set(url, { etag, data });
  }

  return data;
}
```

### 7. Log Sync Operations

Track sync history for debugging:

```typescript
interface SyncLog {
  timestamp: Date;
  newPosts: number;
  updatedPosts: number;
  deletedPosts: number;
  errors: any[];
}

async function syncWithLogging(): Promise<SyncLog> {
  const log: SyncLog = {
    timestamp: new Date(),
    newPosts: 0,
    updatedPosts: 0,
    deletedPosts: 0,
    errors: []
  };

  try {
    // Perform sync...
    // Update log counters...
  } catch (error) {
    log.errors.push(error);
  }

  await saveSyncLog(log);
  return log;
}
```

---

## Security

### Token Storage

**DO:**
- Store tokens in environment variables
- Use secrets management systems (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate tokens before expiration

**DON'T:**
- Commit tokens to version control
- Expose tokens in client-side JavaScript
- Share tokens between environments

### HTTPS Only

Always use HTTPS for API requests. The API will reject HTTP requests.

### Token Expiration

Tokens expire after 365 days. Implement token refresh:

```typescript
// Check token expiration
import jwt from 'jsonwebtoken';

function isTokenExpiring(token: string, daysThreshold = 30): boolean {
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);
  return expiresAt < threshold;
}

if (isTokenExpiring(API_TOKEN)) {
  console.warn('API token expiring soon. Request new token from admin.');
}
```

### IP Whitelisting

Contact your administrator if you need IP whitelisting for enhanced security.

---

## Support & Resources

- **Quick Start**: See [QUICKSTART.md](./QUICKSTART.md)
- **Deduplication Guide**: See [DEDUPLICATION_GUIDE.md](./DEDUPLICATION_GUIDE.md)
- **Example Code**: See [examples/sync-client-example.ts](./examples/sync-client-example.ts)

For technical support, contact your BlogGen administrator.
