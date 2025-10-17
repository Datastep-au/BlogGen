import { users, articles, usage_tracking, clients, user_repos, sites, posts, post_slugs, assets, webhooks, webhook_delivery_logs, scheduled_jobs, type User, type InsertUser, type Article, type InsertArticle, type UsageTracking, type InsertUsageTracking, type Client, type InsertClient, type UserRepo, type InsertUserRepo, type Site, type InsertSite, type Post, type InsertPost, type PostSlug, type InsertPostSlug, type Asset, type InsertAsset, type Webhook, type InsertWebhook, type WebhookDeliveryLog, type InsertWebhookDeliveryLog, type ScheduledJob, type InsertScheduledJob } from "@shared/schema";

export interface IStorage {
  // Client methods
  getClient(id: number): Promise<Client | undefined>;
  getClientBySlug(slug: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: Partial<Client>): Promise<Client>;
  getAllClients(): Promise<Client[]>;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getUsersByClientId(clientId: number): Promise<User[]>;

  // Article methods
  getArticle(id: number): Promise<Article | undefined>;
  getArticlesByUserId(userId: number): Promise<Article[]>;
  getArticlesByClientId(clientId: number): Promise<Article[]>;
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: number, updates: Partial<Article>): Promise<Article>;
  deleteArticle(id: number): Promise<void>;

  // User repositories methods
  getUserRepo(id: string): Promise<UserRepo | undefined>;
  getUserReposByUserId(userId: string): Promise<UserRepo[]>;
  createUserRepo(repo: InsertUserRepo): Promise<UserRepo>;
  updateUserRepo(id: string, updates: Partial<UserRepo>): Promise<UserRepo>;
  deleteUserRepo(id: string): Promise<void>;

  // Usage tracking methods
  getUsageTracking(userId: number, month: string): Promise<UsageTracking | undefined>;
  updateUsageTracking(userId: number, month: string, incrementBy: number): Promise<UsageTracking>;

  // Headless CMS - Site methods
  getSite(id: string): Promise<Site | undefined>;
  getSiteByDomain(domain: string): Promise<Site | undefined>;
  getSitesByClientId(clientId: number): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, updates: Partial<Site>): Promise<Site>;
  deleteSite(id: string): Promise<void>;

  // Headless CMS - Post methods
  getPost(id: string): Promise<Post | undefined>;
  getPostBySlug(siteId: string, slug: string): Promise<Post | undefined>;
  getPostsBySiteId(siteId: string, status?: string, updatedSince?: Date, limit?: number, cursor?: string): Promise<{ posts: Post[], nextCursor: string | null }>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, updates: Partial<Post>): Promise<Post>;
  deletePost(id: string): Promise<void>;

  // Headless CMS - Post slug history methods
  getPostSlugs(postId: string): Promise<PostSlug[]>;
  createPostSlug(postSlug: InsertPostSlug): Promise<PostSlug>;

  // Headless CMS - Asset methods
  getAsset(id: string): Promise<Asset | undefined>;
  getAssetsBySiteId(siteId: string): Promise<Asset[]>;
  getAssetsByPostId(postId: string): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;

  // Headless CMS - Webhook methods
  getWebhook(id: string): Promise<Webhook | undefined>;
  getWebhooksBySiteId(siteId: string): Promise<Webhook[]>;
  getActiveWebhooksBySiteId(siteId: string): Promise<Webhook[]>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook>;
  deleteWebhook(id: string): Promise<void>;

  // Headless CMS - Webhook delivery log methods
  createWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog>;
  getWebhookDeliveryLogs(webhookId: string, limit?: number): Promise<WebhookDeliveryLog[]>;

  // Headless CMS - Scheduled job methods
  getScheduledJob(id: string): Promise<ScheduledJob | undefined>;
  getPendingScheduledJobs(beforeTime: Date): Promise<ScheduledJob[]>;
  createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob>;
  updateScheduledJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob>;
  deleteScheduledJob(id: string): Promise<void>;
}

// MemStorage is deprecated - use DatabaseStorage instead
export class MemStorage implements Partial<IStorage> {
  private clients: Map<number, Client>;
  private users: Map<number, User>;
  private articles: Map<number, Article>;
  private userRepos: Map<string, UserRepo>;
  private usageTracking: Map<string, UsageTracking>;
  private currentClientId: number;
  private currentUserId: number;
  private currentArticleId: number;
  private currentUsageId: number;

  constructor() {
    this.clients = new Map();
    this.users = new Map();
    this.articles = new Map();
    this.userRepos = new Map();
    this.usageTracking = new Map();
    this.currentClientId = 1;
    this.currentUserId = 1;
    this.currentArticleId = 1;
    this.currentUsageId = 1;
  }

  // Client methods
  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientBySlug(slug: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.slug === slug);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.currentClientId++;
    const now = new Date();
    const client: Client = {
      id,
      name: insertClient.name,
      slug: insertClient.slug,
      repo_url: insertClient.repo_url || null,
      github_installation_id: insertClient.github_installation_id || null,
      created_at: now,
      updated_at: now,
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: number, updates: Partial<Client>): Promise<Client> {
    const client = this.clients.get(id);
    if (!client) {
      throw new Error('Client not found');
    }
    const updatedClient: Client = {
      ...client,
      ...updates,
      id, // Ensure ID doesn't change
      updated_at: new Date(),
    };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      email: insertUser.email,
      full_name: insertUser.full_name || null,
      avatar_url: insertUser.avatar_url || null,
      role: insertUser.role || "client_editor",
      client_id: insertUser.client_id || null,
      created_at: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedUser: User = {
      ...user,
      ...updates,
      id, // Ensure ID doesn't change
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsersByClientId(clientId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.client_id === clientId);
  }

  // Article methods
  async getArticle(id: number): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async getArticlesByUserId(userId: number): Promise<Article[]> {
    return Array.from(this.articles.values())
      .filter(article => article.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getArticlesByClientId(clientId: number): Promise<Article[]> {
    return Array.from(this.articles.values())
      .filter(article => article.client_id === clientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = this.currentArticleId++;
    const now = new Date();
    const article: Article = {
      id,
      user_id: insertArticle.user_id,
      client_id: insertArticle.client_id || null,
      title: insertArticle.title,
      slug: insertArticle.slug,
      excerpt: insertArticle.excerpt || null,
      content: insertArticle.content,
      meta_description: insertArticle.meta_description || null,
      keywords: Array.isArray(insertArticle.keywords) ? insertArticle.keywords as string[] : null,
      topic: insertArticle.topic,
      status: insertArticle.status || "draft",
      generation_mode: insertArticle.generation_mode || "manual",
      scheduled_date: insertArticle.scheduled_date || null,
      hero_image_url: insertArticle.hero_image_url || null,
      hero_image_description: insertArticle.hero_image_description || null,
      cover_image_url: insertArticle.cover_image_url || null,
      word_count: insertArticle.word_count || null,
      created_at: now,
      updated_at: now,
    };
    this.articles.set(id, article);
    return article;
  }

  async updateArticle(id: number, updates: Partial<Article>): Promise<Article> {
    const article = this.articles.get(id);
    if (!article) {
      throw new Error('Article not found');
    }

    const updatedArticle: Article = {
      ...article,
      ...updates,
      id, // Ensure ID doesn't change
      updated_at: new Date(),
    };
    
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async deleteArticle(id: number): Promise<void> {
    this.articles.delete(id);
  }

  // User repositories methods
  async getUserRepo(id: string): Promise<UserRepo | undefined> {
    return this.userRepos.get(id);
  }

  async getUserReposByUserId(userId: string): Promise<UserRepo[]> {
    return Array.from(this.userRepos.values())
      .filter(repo => repo.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createUserRepo(insertRepo: InsertUserRepo): Promise<UserRepo> {
    const id = crypto.randomUUID();
    const now = new Date();
    const repo: UserRepo = {
      id,
      user_id: insertRepo.user_id,
      repo_url: insertRepo.repo_url,
      branch: insertRepo.branch || "main",
      deploy_hook_url: insertRepo.deploy_hook_url || null,
      created_at: now,
      updated_at: now,
    };
    this.userRepos.set(id, repo);
    return repo;
  }

  async updateUserRepo(id: string, updates: Partial<UserRepo>): Promise<UserRepo> {
    const repo = this.userRepos.get(id);
    if (!repo) {
      throw new Error('User repository not found');
    }

    const updatedRepo: UserRepo = {
      ...repo,
      ...updates,
      id, // Ensure ID doesn't change
      updated_at: new Date(),
    };
    
    this.userRepos.set(id, updatedRepo);
    return updatedRepo;
  }

  async deleteUserRepo(id: string): Promise<void> {
    this.userRepos.delete(id);
  }

  // Usage tracking methods
  async getUsageTracking(userId: number, month: string): Promise<UsageTracking | undefined> {
    const key = `${userId}-${month}`;
    return this.usageTracking.get(key);
  }

  async updateUsageTracking(userId: number, month: string, incrementBy: number): Promise<UsageTracking> {
    const key = `${userId}-${month}`;
    const existing = this.usageTracking.get(key);
    
    if (existing) {
      const updated: UsageTracking = {
        ...existing,
        articles_generated: (existing.articles_generated || 0) + incrementBy,
        updated_at: new Date(),
      };
      this.usageTracking.set(key, updated);
      return updated;
    } else {
      const id = this.currentUsageId++;
      const now = new Date();
      const newUsage: UsageTracking = {
        id,
        user_id: userId,
        month,
        articles_generated: incrementBy,
        limit: 10,
        created_at: now,
        updated_at: now,
      };
      this.usageTracking.set(key, newUsage);
      return newUsage;
    }
  }
}

// Use database storage only - no memory storage fallback
import { DatabaseStorage } from './db/database';

let storage: IStorage;

async function initializeStorage(): Promise<IStorage> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required. No fallback storage available.');
  }

  console.log('🔗 Connecting to database...');
  const dbStorage = new DatabaseStorage();
  // Test database connection by trying a simple operation
  await dbStorage.getAllClients();
  console.log('✅ Using database storage (PostgreSQL) - Connection successful');
  return dbStorage;
}

// Initialize database storage immediately - no memory storage fallback
console.log('🚀 Initializing Supabase database connection...');

// Initialize storage synchronously using a promise wrapper
async function getStorage(): Promise<IStorage> {
  if (storage) return storage;
  
  storage = await initializeStorage();
  console.log('🎯 BlogGen ready with Supabase database storage');
  return storage;
}

// Start initialization immediately
getStorage().catch(error => {
  console.error('❌ Database connection failed - no fallback available:', error instanceof Error ? error.message : String(error));
  process.exit(1); // Exit if database connection fails
});

export { storage, getStorage };
