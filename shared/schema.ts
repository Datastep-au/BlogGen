import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for user roles
export const userRoleEnum = pgEnum("user_role", ["admin", "client_editor", "client_viewer"]);

// Enum for site roles (for site_members table)
export const siteRoleEnum = pgEnum("site_role", ["owner", "editor", "viewer"]);

// Enum for generation mode
export const generationModeEnum = pgEnum("generation_mode", ["ai", "manual", "mixed"]);

// Enum for article status
export const articleStatusEnum = pgEnum("article_status", ["draft", "scheduled", "published"]);

// Enum for post status (headless CMS)
export const postStatusEnum = pgEnum("post_status", ["draft", "scheduled", "published", "archived"]);

// Enum for webhook event types
export const webhookEventEnum = pgEnum("webhook_event", ["post_published", "post_updated", "post_deleted"]);

// Clients table for multi-tenancy
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly version of name
  repo_url: text("repo_url"), // GitHub repo URL
  github_installation_id: text("github_installation_id"), // GitHub App installation ID
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabase_user_id: uuid("supabase_user_id").unique(), // References auth.users for RLS
  email: text("email").notNull().unique(),
  full_name: text("full_name"),
  avatar_url: text("avatar_url"),
  role: userRoleEnum("role").default("client_editor").notNull(),
  client_id: integer("client_id").references(() => clients.id), // nullable for admins (deprecated in favor of site_members)
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  client_id: integer("client_id").references(() => clients.id), // For multi-tenancy (deprecated)
  site_id: uuid("site_id").notNull().references(() => sites.id), // Direct site reference
  title: text("title").notNull(),
  slug: text("slug").notNull(), // URL-friendly version of title (unique per site)
  excerpt: text("excerpt"), // Short description/summary
  content: text("content").notNull(),
  meta_description: text("meta_description"),
  keywords: json("keywords").$type<string[]>().default([]),
  topic: text("topic").notNull(),
  status: articleStatusEnum("status").default("draft").notNull(),
  generation_mode: generationModeEnum("generation_mode").default("manual").notNull(),
  scheduled_date: timestamp("scheduled_date"), // When the article should be published
  hero_image_url: text("hero_image_url"), // URL of the hero image
  hero_image_description: text("hero_image_description"), // Alt text for hero image
  cover_image_url: text("cover_image_url"), // Cover image for listing/social sharing
  word_count: integer("word_count").default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  siteSlugUnique: {
    name: "articles_site_slug_unique",
    columns: [table.site_id, table.slug]
  }
}));

export const usage_tracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  site_id: uuid("site_id").notNull().references(() => sites.id), // Track by site
  month: text("month").notNull(), // YYYY-MM format
  articles_generated: integer("articles_generated").default(0),
  images_generated: integer("images_generated").default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  siteMonthUnique: {
    name: "usage_tracking_site_month_unique",
    columns: [table.site_id, table.month]
  }
}));

// User repositories table for managing deploy targets
export const user_repos = pgTable("user_repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(), // References auth.users in Supabase
  repo_url: text("repo_url").notNull(),
  branch: text("branch").default("main").notNull(),
  deploy_hook_url: text("deploy_hook_url"), // For Netlify/Vercel/Replit deploys
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== HEADLESS CMS TABLES ====================

// Sites table for multi-tenant headless CMS
// One-to-one relationship with clients: each client has exactly one site
export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  client_id: integer("client_id").notNull().unique().references(() => clients.id, { onDelete: "cascade" }), // One-to-one with clients
  name: text("name").notNull(),
  domain: text("domain"), // e.g. example.com
  storage_bucket_name: text("storage_bucket_name").notNull(), // Dedicated Supabase storage bucket
  api_key_hash: text("api_key_hash").notNull(), // bcrypt hash of API key
  is_active: boolean("is_active").default(true).notNull(),
  monthly_article_limit: integer("monthly_article_limit").default(50).notNull(),
  monthly_image_limit: integer("monthly_image_limit").default(100).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Site members table for many-to-many user-site relationships
export const site_members = pgTable("site_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  site_id: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: siteRoleEnum("role").default("editor").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  siteUserUnique: {
    name: "site_members_site_user_unique",
    columns: [table.site_id, table.user_id]
  }
}));

// Posts table for headless CMS
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  site_id: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  body_md: text("body_md").notNull(), // Markdown content
  body_html: text("body_html"), // Cached HTML render
  tags: text("tags").array().default([]),
  cover_image_url: text("cover_image_url"),
  meta_title: text("meta_title"),
  meta_description: text("meta_description"),
  og_image_url: text("og_image_url"),
  canonical_url: text("canonical_url"),
  noindex: boolean("noindex").default(false),
  status: postStatusEnum("status").default("draft").notNull(),
  published_at: timestamp("published_at"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  content_hash: uuid("content_hash").notNull(), // Deterministic hash of content
}, (table) => ({
  siteSlugUnique: { 
    name: "posts_site_id_slug_unique",
    columns: [table.site_id, table.slug]
  }
}));

// Post slugs history for redirects
export const post_slugs = pgTable("post_slugs", {
  id: serial("id").primaryKey(),
  post_id: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Assets table for images and media
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  site_id: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  post_id: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  alt: text("alt"),
  width: integer("width"),
  height: integer("height"),
  role: text("role"), // 'cover' | 'inline' | 'og' | etc.
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Webhooks table
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  site_id: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  target_url: text("target_url").notNull(),
  secret: text("secret").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Webhook delivery logs
export const webhook_delivery_logs = pgTable("webhook_delivery_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhook_id: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  post_id: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
  event: webhookEventEnum("event").notNull(),
  status_code: integer("status_code"),
  response_body: text("response_body"),
  error: text("error"),
  attempt: integer("attempt").default(1).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Scheduled jobs table (for webhook retries and scheduled posts)
export const scheduled_jobs = pgTable("scheduled_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  job_type: text("job_type").notNull(), // 'webhook_delivery' | 'publish_scheduled_post'
  payload: json("payload").notNull(), // JSON payload for the job
  scheduled_for: timestamp("scheduled_for").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  max_attempts: integer("max_attempts").default(5).notNull(),
  last_error: text("last_error"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertUsageTrackingSchema = createInsertSchema(usage_tracking).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertUserRepoSchema = createInsertSchema(user_repos).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Headless CMS insert schemas
export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  api_key_hash: true, // Generated server-side
  storage_bucket_name: true, // Generated server-side
  created_at: true,
  updated_at: true,
});

export const insertSiteMemberSchema = createInsertSchema(site_members).omit({
  id: true,
  created_at: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  updated_at: true,
});

export const insertPostSlugSchema = createInsertSchema(post_slugs).omit({
  id: true,
  created_at: true,
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  created_at: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  created_at: true,
});

export const insertWebhookDeliveryLogSchema = createInsertSchema(webhook_delivery_logs).omit({
  id: true,
  created_at: true,
});

export const insertScheduledJobSchema = createInsertSchema(scheduled_jobs).omit({
  id: true,
  created_at: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usage_tracking.$inferSelect;
export type InsertUserRepo = z.infer<typeof insertUserRepoSchema>;
export type UserRepo = typeof user_repos.$inferSelect;

// Headless CMS types
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;
export type InsertSiteMember = z.infer<typeof insertSiteMemberSchema>;
export type SiteMember = typeof site_members.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPostSlug = z.infer<typeof insertPostSlugSchema>;
export type PostSlug = typeof post_slugs.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhookDeliveryLog = z.infer<typeof insertWebhookDeliveryLogSchema>;
export type WebhookDeliveryLog = typeof webhook_delivery_logs.$inferSelect;
export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduled_jobs.$inferSelect;

// Export enum types
export type UserRole = "admin" | "client_editor" | "client_viewer";
export type SiteRole = "owner" | "editor" | "viewer";
export type GenerationMode = "ai" | "manual" | "mixed";
export type ArticleStatus = "draft" | "scheduled" | "published";
export type PostStatus = "draft" | "scheduled" | "published" | "archived";
export type WebhookEvent = "post_published" | "post_updated" | "post_deleted";
