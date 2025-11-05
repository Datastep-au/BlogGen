# BlogGen CMS - Deduplication & Sync Strategies

Comprehensive guide on preventing duplicate posts and implementing efficient content synchronization.

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Available Mechanisms](#available-mechanisms)
- [Recommended Strategies](#recommended-strategies)
- [Implementation Examples](#implementation-examples)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)

---

## Overview

When syncing content from BlogGen CMS to your website, you need to:
1. **Avoid importing duplicate posts**
2. **Detect content changes** efficiently
3. **Update only when necessary**
4. **Handle deletions and slug changes**
5. **Minimize API calls and bandwidth**

This guide explains how to implement robust deduplication using BlogGen's built-in features.

---

## The Problem

### Without Deduplication

```typescript
// BAD: Re-imports everything on every sync
async function naiveSync() {
  const posts = await fetchAllPosts();

  for (const post of posts) {
    await database.insertPost(post); // Creates duplicates!
  }
}
```

**Problems:**
- Creates duplicate entries every sync
- Wastes database storage
- Breaks unique constraints
- Confuses users with duplicate content
- Inefficient bandwidth usage

### With Proper Deduplication

```typescript
// GOOD: Only updates changed posts
async function smartSync() {
  const posts = await fetchAllPosts();
  const stored = await getStoredHashes();

  for (const post of posts) {
    if (!stored[post.id]) {
      await createPost(post); // New
    } else if (stored[post.id] !== post.content_hash) {
      await updatePost(post); // Changed
    }
    // Else: Skip unchanged
  }
}
```

**Benefits:**
- No duplicates
- Only updates changed content
- Efficient database operations
- Minimal bandwidth usage
- Fast sync operations

---

## Available Mechanisms

BlogGen provides several built-in mechanisms for deduplication:

### 1. Content Hash (`content_hash`)

**What it is:**
- Deterministic UUID v5 hash of post content
- Generated from: title, slug, body, meta fields, tags
- **Same content always produces the same hash**

**How to use:**
- Store `content_hash` locally for each post
- Compare incoming hash with stored hash
- If different, content changed → update
- If same, content unchanged → skip

**Example:**
```typescript
// Post object includes content_hash
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  content_hash: "b3f4a5c6-d7e8-f9g0-h1i2-j3k4l5m6n7o8", // ← Use this!
  title: "My Blog Post",
  // ... other fields
}
```

**Advantages:**
- Zero API overhead
- Detects any content change
- No timestamp issues
- Deterministic (reliable)

**When to use:** Always! This is the primary deduplication method.

---

### 2. Incremental Sync (`updated_since`)

**What it is:**
- API parameter that filters posts by `updated_at` timestamp
- Only returns posts modified after the specified date

**How to use:**
```typescript
// Fetch only posts updated since last sync
const lastSync = new Date('2025-11-01T00:00:00Z');
const response = await fetch(
  `/sites/${siteId}/posts?updated_since=${lastSync.toISOString()}`
);
```

**Advantages:**
- Reduces API response size
- Faster sync for large catalogs
- Less bandwidth usage
- Efficient for frequent syncs

**Limitations:**
- Doesn't detect deletes (need full sync occasionally)
- Timestamp timezone considerations
- Initial sync still fetches everything

**When to use:** For regular incremental syncs (hourly/daily).

---

### 3. Pagination Cursor

**What it is:**
- Base64-encoded pagination token
- Ensures consistent pagination through large datasets

**How to use:**
```typescript
let cursor = null;
let allPosts = [];

do {
  const url = cursor
    ? `/sites/${siteId}/posts?cursor=${cursor}`
    : `/sites/${siteId}/posts`;

  const response = await fetch(url);
  const data = await response.json();

  allPosts = [...allPosts, ...data.items];
  cursor = data.next_cursor;
} while (cursor);
```

**Advantages:**
- Handles large post catalogs
- Consistent results
- No offset/limit issues

**When to use:** When fetching all posts (>50 posts).

---

### 4. ETag Caching

**What it is:**
- HTTP caching using `ETag` and `If-None-Match` headers
- Returns `304 Not Modified` if content unchanged

**How to use:**
```typescript
// First request - get ETag
const response1 = await fetch(url);
const etag = response1.headers.get('ETag');
const data = await response1.json();

// Later request - use ETag
const response2 = await fetch(url, {
  headers: { 'If-None-Match': etag }
});

if (response2.status === 304) {
  // Use cached data
  return data;
}
```

**Advantages:**
- Saves bandwidth
- Fast responses
- HTTP-standard approach

**When to use:** For frequently-accessed specific endpoints.

---

### 5. Previous Slugs (`previous_slugs`)

**What it is:**
- Array of historical slugs for each post
- Tracks slug changes over time

**How to use:**
```typescript
// Post with slug history
{
  slug: "complete-guide-to-x",
  previous_slugs: ["guide-to-x", "intro-to-x"],
  // ...
}

// Set up redirects
for (const oldSlug of post.previous_slugs) {
  redirect(`/blog/${oldSlug}`, `/blog/${post.slug}`, 301);
}
```

**Advantages:**
- Maintains SEO when URLs change
- No broken links
- Automatic redirect setup

**When to use:** Always check for redirects when importing.

---

## Recommended Strategies

### Strategy 1: Hash-Based Deduplication (Simple)

**Best for:** Small to medium sites, simple requirements

```typescript
interface SyncState {
  posts: Record<string, string>; // id → content_hash
  lastSyncTime: Date;
}

async function hashBasedSync() {
  // 1. Load previous sync state
  const state = await loadSyncState();

  // 2. Fetch all published posts
  const posts = await fetchAllPosts({ status: 'published' });

  // 3. Detect changes
  for (const post of posts) {
    const storedHash = state.posts[post.id];

    if (!storedHash) {
      // New post
      await createPost(post);
      console.log(`Created: ${post.title}`);
    } else if (storedHash !== post.content_hash) {
      // Content changed
      await updatePost(post);
      console.log(`Updated: ${post.title}`);
    } else {
      // No changes
      console.log(`Skipped: ${post.title}`);
    }

    // Update state
    state.posts[post.id] = post.content_hash;
  }

  // 4. Detect deletions
  const incomingIds = new Set(posts.map(p => p.id));
  for (const storedId of Object.keys(state.posts)) {
    if (!incomingIds.has(storedId)) {
      await deletePost(storedId);
      delete state.posts[storedId];
      console.log(`Deleted: ${storedId}`);
    }
  }

  // 5. Save state
  state.lastSyncTime = new Date();
  await saveSyncState(state);
}
```

**Pros:**
- Simple to implement
- Reliable change detection
- Handles deletions

**Cons:**
- Fetches all posts every sync
- More bandwidth for large catalogs

---

### Strategy 2: Incremental + Hash (Recommended)

**Best for:** Medium to large sites, frequent syncs

```typescript
async function incrementalHashSync() {
  const state = await loadSyncState();

  // 1. Fetch only updated posts
  const posts = await fetchAllPosts({
    status: 'published',
    updated_since: state.lastSyncTime.toISOString()
  });

  console.log(`Fetched ${posts.length} updated posts`);

  // 2. Process each post
  for (const post of posts) {
    const storedHash = state.posts[post.id];

    if (!storedHash) {
      // New post
      await createPost(post);
      console.log(`✓ Created: ${post.title}`);
    } else if (storedHash !== post.content_hash) {
      // Content changed
      await updatePost(post);
      console.log(`✓ Updated: ${post.title}`);
    } else {
      // Metadata changed but content same
      console.log(`⊘ Skipped (hash match): ${post.title}`);
    }

    state.posts[post.id] = post.content_hash;
  }

  // 3. Full sync once per day to catch deletions
  if (shouldDoFullSync(state.lastFullSync)) {
    await fullSyncForDeletions(state);
    state.lastFullSync = new Date();
  }

  // 4. Save state
  state.lastSyncTime = new Date();
  await saveSyncState(state);
}

function shouldDoFullSync(lastFullSync: Date): boolean {
  const hoursSince = (Date.now() - lastFullSync.getTime()) / 1000 / 60 / 60;
  return hoursSince >= 24; // Once per day
}

async function fullSyncForDeletions(state: SyncState) {
  const allPosts = await fetchAllPosts({ status: 'published' });
  const liveIds = new Set(allPosts.map(p => p.id));

  for (const storedId of Object.keys(state.posts)) {
    if (!liveIds.has(storedId)) {
      await deletePost(storedId);
      delete state.posts[storedId];
      console.log(`✗ Deleted: ${storedId}`);
    }
  }
}
```

**Pros:**
- Efficient for frequent syncs
- Minimal bandwidth
- Fast execution
- Still detects deletions (daily)

**Cons:**
- Slightly more complex
- Deletions detected with delay

---

### Strategy 3: Database-Backed State

**Best for:** Production environments, multiple workers

```typescript
// Database schema
interface SyncedPost {
  id: string;
  content_hash: string;
  synced_at: Date;
}

async function databaseBackedSync() {
  // 1. Get last sync time from database
  const lastSync = await db.query(
    'SELECT MAX(synced_at) as last_sync FROM synced_posts'
  );

  // 2. Fetch updated posts
  const posts = await fetchAllPosts({
    status: 'published',
    updated_since: lastSync.last_sync?.toISOString()
  });

  // 3. Process in transaction
  await db.transaction(async (tx) => {
    for (const post of posts) {
      // Check if exists
      const existing = await tx.query(
        'SELECT content_hash FROM synced_posts WHERE id = $1',
        [post.id]
      );

      if (!existing) {
        // New post
        await createPost(tx, post);
        await tx.query(
          'INSERT INTO synced_posts (id, content_hash, synced_at) VALUES ($1, $2, $3)',
          [post.id, post.content_hash, new Date()]
        );
      } else if (existing.content_hash !== post.content_hash) {
        // Changed post
        await updatePost(tx, post);
        await tx.query(
          'UPDATE synced_posts SET content_hash = $1, synced_at = $2 WHERE id = $3',
          [post.content_hash, new Date(), post.id]
        );
      }
    }
  });
}
```

**Pros:**
- Robust (ACID guarantees)
- Multi-worker safe
- Queryable sync history
- No separate state files

**Cons:**
- Requires database schema
- More setup complexity

---

## Implementation Examples

### Complete TypeScript Implementation

```typescript
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

interface Post {
  id: string;
  slug: string;
  title: string;
  content_hash: string;
  // ... other fields
}

interface SyncState {
  posts: Record<string, string>; // id → content_hash
  lastSyncTime: Date;
  lastFullSync: Date;
}

class CMSSyncClient {
  private siteId: string;
  private apiToken: string;
  private apiBaseUrl: string;
  private stateFile: string;

  constructor(config: {
    siteId: string;
    apiToken: string;
    apiBaseUrl: string;
    stateFile?: string;
  }) {
    this.siteId = config.siteId;
    this.apiToken = config.apiToken;
    this.apiBaseUrl = config.apiBaseUrl;
    this.stateFile = config.stateFile || './sync-state.json';
  }

  async sync(): Promise<void> {
    console.log('🔄 Starting sync...');

    // Load state
    const state = await this.loadState();

    // Fetch posts (incremental)
    const posts = await this.fetchPosts({
      status: 'published',
      updated_since: state.lastSyncTime.toISOString()
    });

    console.log(`📥 Fetched ${posts.length} posts`);

    // Process posts
    let created = 0, updated = 0, skipped = 0;

    for (const post of posts) {
      const storedHash = state.posts[post.id];

      if (!storedHash) {
        await this.createPost(post);
        created++;
      } else if (storedHash !== post.content_hash) {
        await this.updatePost(post);
        updated++;
      } else {
        skipped++;
      }

      state.posts[post.id] = post.content_hash;
    }

    // Check for deletions (daily)
    let deleted = 0;
    if (this.shouldDoFullSync(state.lastFullSync)) {
      deleted = await this.detectDeletions(state);
      state.lastFullSync = new Date();
    }

    // Save state
    state.lastSyncTime = new Date();
    await this.saveState(state);

    console.log('✅ Sync complete!');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Skipped: ${skipped}`);
  }

  private async fetchPosts(params: any): Promise<Post[]> {
    let allPosts: Post[] = [];
    let cursor: string | null = null;

    do {
      const url = new URL(
        `/sites/${this.siteId}/posts`,
        this.apiBaseUrl
      );

      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v));
      });

      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      allPosts = [...allPosts, ...data.items];
      cursor = data.next_cursor;
    } while (cursor);

    return allPosts;
  }

  private async detectDeletions(state: SyncState): Promise<number> {
    console.log('🔍 Checking for deletions...');

    const allPosts = await this.fetchPosts({ status: 'published' });
    const liveIds = new Set(allPosts.map(p => p.id));

    let deleted = 0;
    for (const storedId of Object.keys(state.posts)) {
      if (!liveIds.has(storedId)) {
        await this.deletePost(storedId);
        delete state.posts[storedId];
        deleted++;
      }
    }

    return deleted;
  }

  private shouldDoFullSync(lastFullSync: Date): boolean {
    const hoursSince = (Date.now() - lastFullSync.getTime()) / 1000 / 60 / 60;
    return hoursSince >= 24;
  }

  private async loadState(): Promise<SyncState> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        posts: parsed.posts || {},
        lastSyncTime: new Date(parsed.lastSyncTime || 0),
        lastFullSync: new Date(parsed.lastFullSync || 0)
      };
    } catch {
      return {
        posts: {},
        lastSyncTime: new Date(0),
        lastFullSync: new Date(0)
      };
    }
  }

  private async saveState(state: SyncState): Promise<void> {
    await fs.writeFile(
      this.stateFile,
      JSON.stringify(state, null, 2)
    );
  }

  private async createPost(post: Post): Promise<void> {
    console.log(`  ✓ Creating: ${post.title}`);
    // Your create logic here
  }

  private async updatePost(post: Post): Promise<void> {
    console.log(`  ✓ Updating: ${post.title}`);
    // Your update logic here
  }

  private async deletePost(id: string): Promise<void> {
    console.log(`  ✗ Deleting: ${id}`);
    // Your delete logic here
  }
}

// Usage
const client = new CMSSyncClient({
  siteId: process.env.SITE_ID!,
  apiToken: process.env.API_TOKEN!,
  apiBaseUrl: 'https://your-api.com/api/cms'
});

client.sync().catch(console.error);
```

---

## Advanced Patterns

### Pattern 1: Webhook-Triggered Sync

Instead of polling, trigger syncs via webhooks:

```typescript
// Webhook handler
app.post('/webhooks/bloggen', async (req, res) => {
  const event = req.body;

  if (event.event === 'post_published' || event.event === 'post_updated') {
    // Fetch specific post
    const post = await fetchPost(event.slug);

    // Update only this post
    if (await postExists(post.id)) {
      await updatePost(post);
    } else {
      await createPost(post);
    }
  }

  if (event.event === 'post_deleted') {
    await deletePost(event.post_id);
  }

  res.json({ ok: true });
});
```

### Pattern 2: Parallel Batch Processing

Process posts in parallel for speed:

```typescript
async function parallelSync(posts: Post[], batchSize = 10) {
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);

    await Promise.all(
      batch.map(post => processPost(post))
    );

    console.log(`Processed ${Math.min(i + batchSize, posts.length)}/${posts.length}`);
  }
}
```

### Pattern 3: Retry with Exponential Backoff

Handle transient failures:

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const backoff = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${maxRetries} after ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Best Practices

### 1. Always Store content_hash

```typescript
// GOOD: Store hash for future comparisons
await database.createPost({
  ...post,
  _content_hash: post.content_hash, // Store this!
  _synced_at: new Date()
});
```

### 2. Use Transactions

```typescript
// GOOD: Atomic updates
await database.transaction(async (tx) => {
  await tx.updatePost(post);
  await tx.updateSyncState(post.id, post.content_hash);
});
```

### 3. Log Everything

```typescript
// GOOD: Comprehensive logging
interface SyncLog {
  timestamp: Date;
  duration: number;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

await saveSyncLog(log);
```

### 4. Handle Slug Changes

```typescript
// GOOD: Set up redirects
for (const oldSlug of post.previous_slugs) {
  if (oldSlug !== post.slug) {
    await createRedirect(
      `/blog/${oldSlug}`,
      `/blog/${post.slug}`,
      301
    );
  }
}
```

### 5. Test Deletion Detection

```typescript
// GOOD: Verify deletion logic
async function testDeletionDetection() {
  const state = { posts: { 'deleted-id': 'hash' } };
  const live = []; // Empty - post deleted

  // Should detect deletion
  await detectDeletions(state, live);
  assert(!state.posts['deleted-id']);
}
```

---

## Summary

**Recommended Approach:**
1. Use **content_hash** for change detection (always)
2. Use **updated_since** for incremental syncs (hourly/daily)
3. Use **full sync** once per day for deletion detection
4. Store sync state (hashes + timestamps)
5. Log all sync operations for debugging

This hybrid approach provides the best balance of efficiency, reliability, and simplicity.

---

## Next Steps

- **See full example code**: [examples/sync-client-example.ts](./examples/sync-client-example.ts)
- **API reference**: [CMS_API_INTEGRATION.md](./CMS_API_INTEGRATION.md)
- **Quick start**: [QUICKSTART.md](./QUICKSTART.md)
