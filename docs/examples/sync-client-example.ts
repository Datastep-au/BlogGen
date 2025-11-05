/**
 * BlogGen CMS Sync Client - Production-Ready Example
 *
 * This is a complete, production-ready implementation of a sync client
 * for the BlogGen CMS API with:
 * - Content hash-based deduplication
 * - Incremental sync with updated_since
 * - Full pagination support
 * - Rate limiting awareness
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Sync state persistence
 * - Deletion detection
 * - Redirect management
 *
 * Usage:
 *   import { BlogGenSyncClient } from './sync-client-example';
 *
 *   const client = new BlogGenSyncClient({
 *     siteId: process.env.SITE_ID!,
 *     apiToken: process.env.API_TOKEN!,
 *     apiBaseUrl: 'https://your-api.com/api/cms',
 *     stateFile: './sync-state.json'
 *   });
 *
 *   await client.sync();
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

interface Post {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_html: string;
  tags: string[];
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  noindex: boolean;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  published_at: string | null;
  updated_at: string;
  previous_slugs: string[];
  content_hash: string;
}

interface PostsResponse {
  items: Post[];
  next_cursor: string | null;
  last_sync: string;
}

interface SyncState {
  posts: Record<string, string>; // post_id → content_hash
  lastSyncTime: string; // ISO 8601
  lastFullSync: string; // ISO 8601
  totalSyncs: number;
  lastSyncStats: SyncStats;
}

interface SyncStats {
  timestamp: string;
  duration: number;
  postsChecked: number;
  postsCreated: number;
  postsUpdated: number;
  postsDeleted: number;
  postsSkipped: number;
  errors: string[];
}

interface ClientConfig {
  siteId: string;
  apiToken: string;
  apiBaseUrl: string;
  stateFile?: string;
  fullSyncIntervalHours?: number;
  maxRetries?: number;
  onPostCreated?: (post: Post) => Promise<void>;
  onPostUpdated?: (post: Post) => Promise<void>;
  onPostDeleted?: (postId: string) => Promise<void>;
  onRedirectCreated?: (oldSlug: string, newSlug: string) => Promise<void>;
}

// ============================================================================
// BlogGen CMS Sync Client
// ============================================================================

export class BlogGenSyncClient {
  private siteId: string;
  private apiToken: string;
  private apiBaseUrl: string;
  private stateFile: string;
  private fullSyncIntervalHours: number;
  private maxRetries: number;

  // Callbacks
  private onPostCreated?: (post: Post) => Promise<void>;
  private onPostUpdated?: (post: Post) => Promise<void>;
  private onPostDeleted?: (postId: string) => Promise<void>;
  private onRedirectCreated?: (oldSlug: string, newSlug: string) => Promise<void>;

  constructor(config: ClientConfig) {
    this.siteId = config.siteId;
    this.apiToken = config.apiToken;
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.stateFile = config.stateFile || './bloggen-sync-state.json';
    this.fullSyncIntervalHours = config.fullSyncIntervalHours || 24;
    this.maxRetries = config.maxRetries || 3;

    this.onPostCreated = config.onPostCreated;
    this.onPostUpdated = config.onPostUpdated;
    this.onPostDeleted = config.onPostDeleted;
    this.onRedirectCreated = config.onRedirectCreated;
  }

  // ==========================================================================
  // Main Sync Method
  // ==========================================================================

  /**
   * Perform a full sync operation
   * - Fetches posts using incremental sync (updated_since)
   * - Detects changes using content_hash
   * - Handles pagination automatically
   * - Detects deletions (daily)
   * - Sets up redirects for slug changes
   */
  async sync(): Promise<SyncStats> {
    const startTime = Date.now();
    console.log('🔄 Starting BlogGen CMS sync...');

    const stats: SyncStats = {
      timestamp: new Date().toISOString(),
      duration: 0,
      postsChecked: 0,
      postsCreated: 0,
      postsUpdated: 0,
      postsDeleted: 0,
      postsSkipped: 0,
      errors: []
    };

    try {
      // 1. Load sync state
      const state = await this.loadState();
      console.log(`📂 Loaded sync state (${Object.keys(state.posts).length} posts tracked)`);

      // 2. Fetch posts (incremental)
      const updatedSince = new Date(state.lastSyncTime);
      console.log(`📥 Fetching posts updated since ${updatedSince.toISOString()}`);

      const posts = await this.fetchAllPosts({
        status: 'published',
        updated_since: updatedSince.toISOString()
      });

      console.log(`📦 Fetched ${posts.length} posts from API`);
      stats.postsChecked = posts.length;

      // 3. Process each post
      for (const post of posts) {
        try {
          await this.processPost(post, state, stats);
        } catch (error) {
          const errorMsg = `Error processing post ${post.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }

      // 4. Handle redirects
      await this.setupRedirects(posts);

      // 5. Check for deletions (daily)
      if (this.shouldDoFullSync(new Date(state.lastFullSync))) {
        console.log('🔍 Running full sync to detect deletions...');
        stats.postsDeleted = await this.detectDeletions(state);
        state.lastFullSync = new Date().toISOString();
      }

      // 6. Update state
      state.lastSyncTime = new Date().toISOString();
      state.totalSyncs++;
      state.lastSyncStats = stats;
      await this.saveState(state);

      // 7. Calculate duration
      stats.duration = Date.now() - startTime;

      // 8. Print summary
      this.printSyncSummary(stats);

      return stats;
    } catch (error) {
      console.error('💥 Sync failed:', error);
      stats.errors.push(`Sync failed: ${error}`);
      stats.duration = Date.now() - startTime;
      throw error;
    }
  }

  // ==========================================================================
  // Post Processing
  // ==========================================================================

  private async processPost(
    post: Post,
    state: SyncState,
    stats: SyncStats
  ): Promise<void> {
    const storedHash = state.posts[post.id];

    if (!storedHash) {
      // New post
      console.log(`  ✅ Creating: ${post.title}`);
      if (this.onPostCreated) {
        await this.onPostCreated(post);
      }
      state.posts[post.id] = post.content_hash;
      stats.postsCreated++;
    } else if (storedHash !== post.content_hash) {
      // Content changed
      console.log(`  🔄 Updating: ${post.title}`);
      if (this.onPostUpdated) {
        await this.onPostUpdated(post);
      }
      state.posts[post.id] = post.content_hash;
      stats.postsUpdated++;
    } else {
      // No changes
      console.log(`  ⏭️  Skipped (unchanged): ${post.title}`);
      stats.postsSkipped++;
    }
  }

  private async detectDeletions(state: SyncState): Promise<number> {
    const allPosts = await this.fetchAllPosts({ status: 'published' });
    const liveIds = new Set(allPosts.map(p => p.id));

    let deleted = 0;
    for (const storedId of Object.keys(state.posts)) {
      if (!liveIds.has(storedId)) {
        console.log(`  🗑️  Deleting: ${storedId}`);
        if (this.onPostDeleted) {
          await this.onPostDeleted(storedId);
        }
        delete state.posts[storedId];
        deleted++;
      }
    }

    return deleted;
  }

  private async setupRedirects(posts: Post[]): Promise<void> {
    if (!this.onRedirectCreated) return;

    let redirects = 0;
    for (const post of posts) {
      for (const oldSlug of post.previous_slugs) {
        if (oldSlug !== post.slug) {
          console.log(`  🔀 Redirect: ${oldSlug} → ${post.slug}`);
          await this.onRedirectCreated(oldSlug, post.slug);
          redirects++;
        }
      }
    }

    if (redirects > 0) {
      console.log(`📍 Set up ${redirects} redirect(s)`);
    }
  }

  // ==========================================================================
  // API Methods
  // ==========================================================================

  /**
   * Fetch all posts with pagination
   */
  private async fetchAllPosts(params: {
    status?: string;
    updated_since?: string;
  }): Promise<Post[]> {
    let allPosts: Post[] = [];
    let cursor: string | null = null;
    let page = 0;

    do {
      page++;
      const queryParams: Record<string, string> = {
        ...params,
        limit: '100'
      };

      if (cursor) {
        queryParams.cursor = cursor;
      }

      console.log(`  📄 Fetching page ${page}...`);
      const response = await this.fetchWithRetry<PostsResponse>(
        `/sites/${this.siteId}/posts`,
        queryParams
      );

      allPosts = [...allPosts, ...response.items];
      cursor = response.next_cursor;
    } while (cursor);

    return allPosts;
  }

  /**
   * Generic API request with retry logic
   */
  private async fetchWithRetry<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(endpoint, this.apiBaseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'User-Agent': 'BlogGen-Sync-Client/1.0'
          }
        });

        // Success
        if (response.ok) {
          return await response.json() as T;
        }

        // Rate limited - wait and retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          console.warn(`⚠️  Rate limited. Waiting ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Client error (4xx) - don't retry
        if (response.status >= 400 && response.status < 500) {
          const error = await response.json();
          throw new Error(`API Error ${response.status}: ${JSON.stringify(error)}`);
        }

        // Server error (5xx) - retry with backoff
        if (response.status >= 500) {
          if (attempt < this.maxRetries - 1) {
            const backoff = Math.pow(2, attempt) * 1000;
            console.warn(`⚠️  Server error ${response.status}. Retrying in ${backoff}ms...`);
            await this.sleep(backoff);
            continue;
          }
          throw new Error(`Server error ${response.status} after ${this.maxRetries} attempts`);
        }

      } catch (error) {
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
        const backoff = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️  Request failed. Retrying in ${backoff}ms...`);
        await this.sleep(backoff);
      }
    }

    throw new Error('Max retries exceeded');
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  private async loadState(): Promise<SyncState> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        posts: parsed.posts || {},
        lastSyncTime: parsed.lastSyncTime || new Date(0).toISOString(),
        lastFullSync: parsed.lastFullSync || new Date(0).toISOString(),
        totalSyncs: parsed.totalSyncs || 0,
        lastSyncStats: parsed.lastSyncStats || this.emptyStats()
      };
    } catch (error) {
      // First run - create initial state
      console.log('📝 Creating new sync state');
      return {
        posts: {},
        lastSyncTime: new Date(0).toISOString(),
        lastFullSync: new Date(0).toISOString(),
        totalSyncs: 0,
        lastSyncStats: this.emptyStats()
      };
    }
  }

  private async saveState(state: SyncState): Promise<void> {
    const dir = path.dirname(this.stateFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.stateFile,
      JSON.stringify(state, null, 2),
      'utf-8'
    );
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private shouldDoFullSync(lastFullSync: Date): boolean {
    const hoursSince = (Date.now() - lastFullSync.getTime()) / 1000 / 60 / 60;
    return hoursSince >= this.fullSyncIntervalHours;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private emptyStats(): SyncStats {
    return {
      timestamp: new Date().toISOString(),
      duration: 0,
      postsChecked: 0,
      postsCreated: 0,
      postsUpdated: 0,
      postsDeleted: 0,
      postsSkipped: 0,
      errors: []
    };
  }

  private printSyncSummary(stats: SyncStats): void {
    console.log('\n✅ Sync complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Duration:    ${(stats.duration / 1000).toFixed(2)}s`);
    console.log(`   Checked:     ${stats.postsChecked}`);
    console.log(`   Created:     ${stats.postsCreated}`);
    console.log(`   Updated:     ${stats.postsUpdated}`);
    console.log(`   Deleted:     ${stats.postsDeleted}`);
    console.log(`   Skipped:     ${stats.postsSkipped}`);
    if (stats.errors.length > 0) {
      console.log(`   Errors:      ${stats.errors.length}`);
      stats.errors.forEach(err => console.log(`     - ${err}`));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function exampleUsage() {
  const client = new BlogGenSyncClient({
    siteId: process.env.BLOGGEN_SITE_ID!,
    apiToken: process.env.BLOGGEN_API_TOKEN!,
    apiBaseUrl: process.env.BLOGGEN_API_URL || 'https://your-api.com/api/cms',
    stateFile: './bloggen-sync-state.json',
    fullSyncIntervalHours: 24,

    // Implement your own post handlers
    onPostCreated: async (post) => {
      console.log(`    Creating post in database: ${post.title}`);
      // await database.posts.create({
      //   id: post.id,
      //   title: post.title,
      //   slug: post.slug,
      //   body: post.body_html,
      //   published_at: post.published_at,
      //   // ... other fields
      // });
    },

    onPostUpdated: async (post) => {
      console.log(`    Updating post in database: ${post.title}`);
      // await database.posts.update(post.id, {
      //   title: post.title,
      //   body: post.body_html,
      //   // ... other fields
      // });
    },

    onPostDeleted: async (postId) => {
      console.log(`    Deleting post from database: ${postId}`);
      // await database.posts.delete(postId);
    },

    onRedirectCreated: async (oldSlug, newSlug) => {
      console.log(`    Creating 301 redirect: ${oldSlug} → ${newSlug}`);
      // await database.redirects.create({
      //   from: `/blog/${oldSlug}`,
      //   to: `/blog/${newSlug}`,
      //   statusCode: 301
      // });
    }
  });

  // Run sync
  const stats = await client.sync();

  // Check if errors occurred
  if (stats.errors.length > 0) {
    console.error('Sync completed with errors');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  exampleUsage().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
