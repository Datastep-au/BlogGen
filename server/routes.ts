import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateBlogArticle, generateMultipleBlogArticles } from "./lib/openai";
import { insertArticleSchema, insertClientSchema } from "@shared/schema";
import { z } from "zod";
import { githubService } from "./services/github";
import { emailService } from "./services/email";
import { optimizeImage, getImagePublicUrl } from "./utils/imageOptimizer";
import cmsRouter from "./routes/cms";
import adminSitesRouter from "./routes/admin/sites";
import adminWebhooksRouter from "./routes/admin/webhooks";
import adminPostsRouter from "./routes/admin/posts";

const generateRequestSchema = z.object({
  topic: z.string().optional(),
  bulk_topics: z.array(z.string()).optional(),
}).refine(data => data.topic || data.bulk_topics, {
  message: "Either topic or bulk_topics must be provided"
});

// Admin check middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const user = await storage.getUser(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Client access check middleware
const requireClientAccess = async (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const user = await storage.getUser(req.user.id);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Admins have access to everything
  if (user.role === "admin") {
    next();
    return;
  }
  
  // Client users can only access their own data
  req.clientId = user.client_id;
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== ADMIN ROUTES ====================
  
  // Create new client workspace
  app.post("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Client name is required" });
      }

      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      
      // Check if client with this slug already exists
      const existingClient = await storage.getClientBySlug(slug);
      if (existingClient) {
        return res.status(409).json({ error: "Client with this name already exists" });
      }

      // Create GitHub repository (skip if no token configured)
      let repo_url = null;
      if (process.env.GITHUB_TOKEN || process.env.GITHUB_PAT) {
        const { repo_url: repoUrl, success, error } = await githubService.createClientRepo(name);
        if (success) {
          repo_url = repoUrl;
        } else {
          console.warn("GitHub repo creation failed:", error);
        }
      }

      // Create client in database
      const client = await storage.createClient({
        name,
        slug,
        repo_url,
      });

      res.json({
        success: true,
        client,
        repo_url,
        message: `Client workspace created successfully with repository at ${repo_url}`
      });
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ 
        error: "Failed to create client workspace",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all clients
  app.get("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Invite user to client workspace
  app.post("/api/admin/clients/:clientId/invite", requireAdmin, async (req, res) => {
    try {
      const { email, role = "client_editor" } = req.body;
      const clientId = parseInt(req.params.clientId);
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if client exists
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      let isNewUser = false;
      
      if (user) {
        // Update existing user's client assignment
        user = await storage.updateUser(user.id, {
          client_id: clientId,
          role: role as any,
        });
      } else {
        // Create new user
        user = await storage.createUser({
          email,
          client_id: clientId,
          role: role as any,
        });
        isNewUser = true;
      }

      // Send invitation email
      const currentUser = await storage.getUser(req.user!.id);
      const inviterName = currentUser?.full_name || currentUser?.email || 'BlogGen Admin';
      
      const emailResult = await emailService.sendInvitationEmail(
        email,
        user.full_name || email.split('@')[0], // Use name or email prefix
        client.name,
        role,
        inviterName
      );

      if (!emailResult.success) {
        console.warn('Failed to send invitation email:', emailResult.error);
        // Don't fail the whole operation if email fails, just warn
      }

      res.json({
        success: true,
        user,
        emailSent: emailResult.success,
        message: emailResult.success 
          ? `User ${email} has been invited to ${client.name} workspace and an invitation email has been sent`
          : `User ${email} has been added to ${client.name} workspace, but email delivery failed`
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ error: "Failed to invite user" });
    }
  });

  // Get users for a client
  app.get("/api/admin/clients/:clientId/users", requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const users = await storage.getUsersByClientId(clientId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching client users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Test email endpoint
  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const emailResult = await emailService.sendTestEmail(email);
      
      res.json({
        success: emailResult.success,
        message: emailResult.success 
          ? "Test email sent successfully" 
          : `Failed to send test email: ${emailResult.error}`
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // ==================== CLIENT ROUTES ====================
  // Generate article endpoint (with multi-tenant support)
  app.post("/api/generate-article", requireClientAccess, async (req, res) => {
    try {
      const data = generateRequestSchema.parse(req.body);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get client ID (either from user's assignment or admin's selection)
      const clientId = req.body.client_id || user.client_id;
      
      if (!clientId && user.role !== "admin") {
        return res.status(400).json({ error: "No client workspace assigned" });
      }

      // Check monthly usage limit
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const usage = await storage.getUsageTracking(userId, currentMonth);
      const topicsToGenerate = data.bulk_topics?.length || 1;
      
      if (usage && (usage.articles_generated || 0) + topicsToGenerate > (usage.limit || 10)) {
        return res.status(429).json({ 
          error: "Monthly limit exceeded",
          message: `You can only generate ${(usage.limit || 10) - (usage.articles_generated || 0)} more articles this month`
        });
      }

      let generatedCount = 0;
      const errors: string[] = [];
      const createdArticles: any[] = [];

      if (data.topic) {
        // Single article generation
        try {
          const article = await generateBlogArticle(data.topic);
          
          // Generate hero image if requested
          let heroImageUrl = null;
          let heroImageDescription = null;
          
          if (req.body.generate_image) {
            const imagePrompt = req.body.image_prompt || 
              `Professional blog hero image for article about: ${data.topic}. High quality, modern, visually appealing.`;
            
            // Note: Image generation would be handled by a separate service
            // For now, we'll store the prompt for later processing
            heroImageDescription = imagePrompt;
            // In production, you would call an image generation API here
            // heroImageUrl = await generateImage(imagePrompt);
          }
          
          const createdArticle = await storage.createArticle({
            user_id: userId,
            client_id: clientId,
            slug: article.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
            title: article.title,
            content: article.content,
            excerpt: article.metaDescription?.substring(0, 200) || null,
            meta_description: article.metaDescription,
            keywords: article.keywords,
            topic: data.topic,
            status: "draft",
            generation_mode: "ai",
            scheduled_date: req.body.scheduled_date || null,
            hero_image_url: heroImageUrl,
            hero_image_description: heroImageDescription,
            word_count: article.wordCount,
          });
          createdArticles.push(createdArticle);
          generatedCount = 1;

          // Commit to GitHub if client has a repo
          if (clientId && req.body.commit_to_repo) {
            const client = await storage.getClient(clientId);
            if (client && client.repo_url) {
              const commitResult = await githubService.commitPost(client, createdArticle);
              if (!commitResult.success) {
                errors.push(`Warning: Article created but failed to commit to GitHub: ${commitResult.error}`);
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to generate article for "${data.topic}": ${errorMessage}`);
        }
      } else if (data.bulk_topics) {
        // Bulk article generation
        const { articles, errors: generationErrors } = await generateMultipleBlogArticles(data.bulk_topics);
        errors.push(...generationErrors);

        for (const article of articles) {
          try {
            const topic = data.bulk_topics[articles.indexOf(article)];
            
            // Generate hero image if requested
            let heroImageUrl = null;
            let heroImageDescription = null;
            
            if (req.body.generate_image) {
              const imagePrompt = req.body.image_prompt || 
                `Professional blog hero image for article about: ${topic}. High quality, modern, visually appealing.`;
              heroImageDescription = imagePrompt;
              // In production, you would call an image generation API here
              // heroImageUrl = await generateImage(imagePrompt);
            }
            
            const createdArticle = await storage.createArticle({
              user_id: userId,
              client_id: clientId,
              slug: article.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
              title: article.title,
              content: article.content,
              excerpt: article.metaDescription?.substring(0, 200) || null,
              meta_description: article.metaDescription,
              keywords: article.keywords,
              topic: topic,
              status: "draft",
              generation_mode: "ai",
              scheduled_date: req.body.scheduled_date || null,
              hero_image_url: heroImageUrl,
              hero_image_description: heroImageDescription,
              word_count: article.wordCount,
            });
            createdArticles.push(createdArticle);
            generatedCount++;

            // Commit to GitHub if requested
            if (clientId && req.body.commit_to_repo) {
              const client = await storage.getClient(clientId);
              if (client && client.repo_url) {
                const commitResult = await githubService.commitPost(client, createdArticle);
                if (!commitResult.success) {
                  errors.push(`Warning: Article "${article.title}" created but failed to commit: ${commitResult.error}`);
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to save article: ${errorMessage}`);
          }
        }
      }

      // Update usage tracking
      if (generatedCount > 0) {
        await storage.updateUsageTracking(userId, currentMonth, generatedCount);
      }

      res.json({
        success: generatedCount > 0,
        message: data.bulk_topics 
          ? `Generated ${generatedCount} out of ${data.bulk_topics.length} articles`
          : generatedCount > 0 ? "Article generated successfully" : "Failed to generate article",
        generated_count: generatedCount,
        total_requested: data.bulk_topics?.length || 1,
        articles: createdArticles,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Error in generate-article:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get user articles (with multi-tenant filtering)
  app.get("/api/articles", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      let articles: any[];
      if (user.role === "admin") {
        // Admin can see all articles or filter by client
        const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
        if (clientId) {
          articles = await storage.getArticlesByClientId(clientId);
        } else {
          articles = await storage.getArticlesByUserId(userId);
        }
      } else {
        // Client users see only their client's articles
        if (user.client_id) {
          articles = await storage.getArticlesByClientId(user.client_id);
        } else {
          articles = [];
        }
      }

      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  // Update article (with multi-tenant access control)
  app.put("/api/articles/:id", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const articleId = parseInt(req.params.id);
      const updateData = req.body;

      // Verify article access
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Check permissions
      if (user.role !== "admin") {
        // Client users can only edit articles in their workspace
        if (article.client_id !== user.client_id) {
          return res.status(403).json({ error: "Access denied" });
        }
        // Client viewers cannot edit
        if (user.role === "client_viewer") {
          return res.status(403).json({ error: "Viewers cannot edit articles" });
        }
      }

      const updatedArticle = await storage.updateArticle(articleId, updateData);

      // Commit to GitHub if requested and status changed to published
      if (updateData.status === "published" && req.body.commit_to_repo) {
        const client = article.client_id ? await storage.getClient(article.client_id) : null;
        if (client && client.repo_url) {
          await githubService.commitPost(client, updatedArticle);
        }
      }

      res.json(updatedArticle);
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Delete article (with multi-tenant access control)
  app.delete("/api/articles/:id", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const articleId = parseInt(req.params.id);

      // Verify article access
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Check permissions
      if (user.role !== "admin") {
        // Client users can only delete articles in their workspace
        if (article.client_id !== user.client_id) {
          return res.status(403).json({ error: "Access denied" });
        }
        // Client viewers cannot delete
        if (user.role === "client_viewer") {
          return res.status(403).json({ error: "Viewers cannot delete articles" });
        }
      }

      await storage.deleteArticle(articleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Get user profile
  app.get("/api/user/profile", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role: user.role,
        client_id: user.client_id,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // Get usage stats
  app.get("/api/usage", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const currentMonth = new Date().toISOString().substring(0, 7);
      const usage = await storage.getUsageTracking(userId, currentMonth);
      
      res.json({
        count: usage?.articles_generated || 0,
        limit: usage?.limit || 10,
        month: currentMonth
      });
    } catch (error) {
      console.error("Error fetching usage:", error);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  // ==================== IMAGE ROUTES ====================

  // Optimize an image
  app.post("/api/images/optimize", requireClientAccess, async (req, res) => {
    try {
      const { imagePath, width, height, quality, format } = req.body;

      if (!imagePath) {
        return res.status(400).json({ error: "Image path is required" });
      }

      const optimizedPath = await optimizeImage(imagePath, {
        width: width || 1920,
        height: height,
        quality: quality || 80,
        format: format || 'webp'
      });

      const publicUrl = await getImagePublicUrl(optimizedPath);

      res.json({
        originalPath: imagePath,
        optimizedPath,
        publicUrl,
        format: format || 'webp'
      });
    } catch (error) {
      console.error("Error optimizing image:", error);
      res.status(500).json({ error: "Failed to optimize image" });
    }
  });

  // Get public URL for an image
  app.post("/api/images/url", requireClientAccess, async (req, res) => {
    try {
      const { imagePath } = req.body;

      if (!imagePath) {
        return res.status(400).json({ error: "Image path is required" });
      }

      const publicUrl = await getImagePublicUrl(imagePath);

      res.json({
        imagePath,
        publicUrl
      });
    } catch (error) {
      console.error("Error getting image URL:", error);
      res.status(500).json({ error: "Failed to get image URL" });
    }
  });

  // Register CMS API routes (headless CMS for client sites)
  app.use("/v1", cmsRouter);

  // Register admin routes for site and webhook management
  app.use("/api/admin/sites", requireAdmin, adminSitesRouter);
  app.use("/api/admin/webhooks", requireAdmin, adminWebhooksRouter);
  app.use("/api/admin/posts", requireAdmin, adminPostsRouter);

  const httpServer = createServer(app);
  return httpServer;
}
