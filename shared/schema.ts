import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for user roles
export const userRoleEnum = pgEnum("user_role", ["admin", "client_editor", "client_viewer"]);

// Enum for generation mode
export const generationModeEnum = pgEnum("generation_mode", ["ai", "manual", "mixed"]);

// Enum for article status
export const articleStatusEnum = pgEnum("article_status", ["draft", "scheduled", "published"]);

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
  email: text("email").notNull().unique(),
  full_name: text("full_name"),
  avatar_url: text("avatar_url"),
  role: userRoleEnum("role").default("client_editor").notNull(),
  client_id: integer("client_id").references(() => clients.id), // nullable for admins
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  client_id: integer("client_id").references(() => clients.id), // For multi-tenancy
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly version of title
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
});

export const usage_tracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  month: text("month").notNull(), // YYYY-MM format
  articles_generated: integer("articles_generated").default(0),
  limit: integer("limit").default(10),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

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

// Export enum types
export type UserRole = "admin" | "client_editor" | "client_viewer";
export type GenerationMode = "ai" | "manual" | "mixed";
export type ArticleStatus = "draft" | "scheduled" | "published";
