import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, articles, usage_tracking, clients, user_repos, sites, posts, post_slugs, assets, webhooks, webhook_delivery_logs, scheduled_jobs, type User, type InsertUser, type Article, type InsertArticle, type UsageTracking, type InsertUsageTracking, type Client, type InsertClient, type UserRepo, type InsertUserRepo, type Site, type InsertSite, type Post, type InsertPost, type PostSlug, type InsertPostSlug, type Asset, type InsertAsset, type Webhook, type InsertWebhook, type WebhookDeliveryLog, type InsertWebhookDeliveryLog, type ScheduledJob, type InsertScheduledJob } from '@shared/schema';
import { eq, and, lte, desc, isNull, gt } from 'drizzle-orm';
import type { IStorage } from '../storage';

// Use DATABASE_URL which connects to the working heliumdb database
const connectionString = process.env.DATABASE_URL!;

const sql = postgres(connectionString, { prepare: false });

export const db = drizzle(sql);

export class DatabaseStorage implements IStorage {
  // Client methods
  async getClient(id: number): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async getClientBySlug(slug: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
    return result[0];
  }

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: number, updates: Partial<Client>): Promise<Client> {
    const result = await db.update(clients)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(clients.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Client not found');
    }
    return result[0];
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('User not found');
    }
    return result[0];
  }

  async getUsersByClientId(clientId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.client_id, clientId));
  }

  // Article methods
  async getArticle(id: number): Promise<Article | undefined> {
    const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    return result[0];
  }

  async getArticlesByUserId(userId: number): Promise<Article[]> {
    return await db.select().from(articles)
      .where(eq(articles.user_id, userId))
      .orderBy(articles.created_at);
  }

  async getArticlesByClientId(clientId: number): Promise<Article[]> {
    return await db.select().from(articles)
      .where(eq(articles.client_id, clientId))
      .orderBy(articles.created_at);
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const result = await db.insert(articles).values([article]).returning();
    return result[0];
  }

  async updateArticle(id: number, updates: Partial<Article>): Promise<Article> {
    const result = await db.update(articles)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(articles.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Article not found');
    }
    return result[0];
  }

  async deleteArticle(id: number): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  // Usage tracking methods
  async getUsageTracking(userId: number, month: string): Promise<UsageTracking | undefined> {
    const result = await db.select().from(usage_tracking)
      .where(and(eq(usage_tracking.user_id, userId), eq(usage_tracking.month, month)))
      .limit(1);
    return result[0];
  }

  async updateUsageTracking(userId: number, month: string, incrementBy: number): Promise<UsageTracking> {
    // Try to get existing record
    const existing = await this.getUsageTracking(userId, month);
    
    if (existing) {
      // Update existing record
      const result = await db.update(usage_tracking)
        .set({
          articles_generated: (existing.articles_generated || 0) + incrementBy,
          updated_at: new Date(),
        })
        .where(eq(usage_tracking.id, existing.id))
        .returning();
      
      return result[0];
    } else {
      // Create new record
      const result = await db.insert(usage_tracking).values({
        user_id: userId,
        month,
        articles_generated: incrementBy,
        limit: 10,
      }).returning();
      
      return result[0];
    }
  }

  // User repositories methods
  async getUserRepo(id: string): Promise<UserRepo | undefined> {
    const result = await db.select().from(user_repos).where(eq(user_repos.id, id)).limit(1);
    return result[0];
  }

  async getUserReposByUserId(userId: string): Promise<UserRepo[]> {
    return await db.select().from(user_repos)
      .where(eq(user_repos.user_id, userId))
      .orderBy(user_repos.created_at);
  }

  async createUserRepo(repo: InsertUserRepo): Promise<UserRepo> {
    const result = await db.insert(user_repos).values(repo).returning();
    return result[0];
  }

  async updateUserRepo(id: string, updates: Partial<UserRepo>): Promise<UserRepo> {
    const result = await db.update(user_repos)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(user_repos.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('User repository not found');
    }
    return result[0];
  }

  async deleteUserRepo(id: string): Promise<void> {
    await db.delete(user_repos).where(eq(user_repos.id, id));
  }

  // Headless CMS - Site methods
  async getSite(id: string): Promise<Site | undefined> {
    const result = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return result[0];
  }

  async getSiteByDomain(domain: string): Promise<Site | undefined> {
    const result = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
    return result[0];
  }

  async getSitesByClientId(clientId: number): Promise<Site[]> {
    return await db.select().from(sites).where(eq(sites.client_id, clientId));
  }

  async createSite(site: InsertSite): Promise<Site> {
    const result = await db.insert(sites).values(site).returning();
    return result[0];
  }

  async updateSite(id: string, updates: Partial<Site>): Promise<Site> {
    const result = await db.update(sites)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(sites.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Site not found');
    }
    return result[0];
  }

  async deleteSite(id: string): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  // Headless CMS - Post methods
  async getPost(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPostBySlug(siteId: string, slug: string): Promise<Post | undefined> {
    const result = await db.select().from(posts)
      .where(and(eq(posts.site_id, siteId), eq(posts.slug, slug)))
      .limit(1);
    return result[0];
  }

  async getPostsBySiteId(
    siteId: string, 
    status?: string, 
    updatedSince?: Date, 
    limit: number = 50, 
    cursor?: string
  ): Promise<{ posts: Post[], nextCursor: string | null }> {
    let query = db.select().from(posts).where(eq(posts.site_id, siteId));
    
    const conditions = [eq(posts.site_id, siteId)];
    
    if (status) {
      conditions.push(eq(posts.status, status as any));
    }
    
    if (updatedSince) {
      conditions.push(gt(posts.updated_at, updatedSince));
    }
    
    if (cursor) {
      try {
        const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        if (decodedCursor.updated_at) {
          conditions.push(gt(posts.updated_at, new Date(decodedCursor.updated_at)));
        }
      } catch (error) {
        // Invalid cursor - ignore and start from beginning
        console.warn('Invalid cursor provided, ignoring:', error);
      }
    }
    
    const result = await db.select().from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.updated_at))
      .limit(limit + 1);
    
    const hasMore = result.length > limit;
    const postsToReturn = hasMore ? result.slice(0, limit) : result;
    
    let nextCursor: string | null = null;
    if (hasMore && postsToReturn.length > 0) {
      const lastPost = postsToReturn[postsToReturn.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        site_id: siteId,
        updated_at: lastPost.updated_at,
        id: lastPost.id
      })).toString('base64');
    }
    
    return {
      posts: postsToReturn,
      nextCursor
    };
  }

  async createPost(post: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values(post).returning();
    return result[0];
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post> {
    const result = await db.update(posts)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(posts.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Post not found');
    }
    return result[0];
  }

  async deletePost(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  // Headless CMS - Post slug history methods
  async getPostSlugs(postId: string): Promise<PostSlug[]> {
    return await db.select().from(post_slugs)
      .where(eq(post_slugs.post_id, postId))
      .orderBy(desc(post_slugs.created_at));
  }

  async createPostSlug(postSlug: InsertPostSlug): Promise<PostSlug> {
    const result = await db.insert(post_slugs).values(postSlug).returning();
    return result[0];
  }

  // Headless CMS - Asset methods
  async getAsset(id: string): Promise<Asset | undefined> {
    const result = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return result[0];
  }

  async getAssetsBySiteId(siteId: string): Promise<Asset[]> {
    return await db.select().from(assets).where(eq(assets.site_id, siteId));
  }

  async getAssetsByPostId(postId: string): Promise<Asset[]> {
    return await db.select().from(assets).where(eq(assets.post_id, postId));
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await db.insert(assets).values(asset).returning();
    return result[0];
  }

  async deleteAsset(id: string): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  // Headless CMS - Webhook methods
  async getWebhook(id: string): Promise<Webhook | undefined> {
    const result = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    return result[0];
  }

  async getWebhooksBySiteId(siteId: string): Promise<Webhook[]> {
    return await db.select().from(webhooks).where(eq(webhooks.site_id, siteId));
  }

  async getActiveWebhooksBySiteId(siteId: string): Promise<Webhook[]> {
    return await db.select().from(webhooks)
      .where(and(eq(webhooks.site_id, siteId), eq(webhooks.is_active, true)));
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const result = await db.insert(webhooks).values(webhook).returning();
    return result[0];
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    const result = await db.update(webhooks)
      .set(updates)
      .where(eq(webhooks.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Webhook not found');
    }
    return result[0];
  }

  async deleteWebhook(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  // Headless CMS - Webhook delivery log methods
  async createWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog> {
    const result = await db.insert(webhook_delivery_logs).values(log).returning();
    return result[0];
  }

  async getWebhookDeliveryLogs(webhookId: string, limit: number = 50): Promise<WebhookDeliveryLog[]> {
    return await db.select().from(webhook_delivery_logs)
      .where(eq(webhook_delivery_logs.webhook_id, webhookId))
      .orderBy(desc(webhook_delivery_logs.created_at))
      .limit(limit);
  }

  // Headless CMS - Scheduled job methods
  async getScheduledJob(id: string): Promise<ScheduledJob | undefined> {
    const result = await db.select().from(scheduled_jobs).where(eq(scheduled_jobs.id, id)).limit(1);
    return result[0];
  }

  async getPendingScheduledJobs(beforeTime: Date): Promise<ScheduledJob[]> {
    return await db.select().from(scheduled_jobs)
      .where(and(
        lte(scheduled_jobs.scheduled_for, beforeTime),
        isNull(scheduled_jobs.completed_at)
      ))
      .orderBy(scheduled_jobs.scheduled_for);
  }

  async createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob> {
    const result = await db.insert(scheduled_jobs).values(job).returning();
    return result[0];
  }

  async updateScheduledJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob> {
    const result = await db.update(scheduled_jobs)
      .set(updates)
      .where(eq(scheduled_jobs.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error('Scheduled job not found');
    }
    return result[0];
  }

  async deleteScheduledJob(id: string): Promise<void> {
    await db.delete(scheduled_jobs).where(eq(scheduled_jobs.id, id));
  }
}