import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, articles, usage_tracking, clients, user_repos, type User, type InsertUser, type Article, type InsertArticle, type UsageTracking, type InsertUsageTracking, type Client, type InsertClient, type UserRepo, type InsertUserRepo } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
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
}