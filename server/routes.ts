import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateBlogArticle, generateMultipleBlogArticles } from "./lib/openai";
import { insertArticleSchema, insertClientSchema, type Article } from "@shared/schema";
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

const HERO_IMAGE_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function prepareHeroImageForCommit(article: Article) {
  const heroUrl = article.hero_image_url;

  if (!heroUrl || !/^https?:\/\//i.test(heroUrl)) {
    return null;
  }

  try {
    const response = await fetch(heroUrl);
    if (!response.ok) {
      throw new Error(`Failed to download hero image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "";
    const extension =
      HERO_IMAGE_TYPE_EXTENSION[contentType.toLowerCase()] ||
      (heroUrl.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg");

    const normalizedExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const slug = article.slug || article.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    const fileName = `${slug}-hero.${normalizedExtension}`;

    return {
      fileName,
      data: buffer,
      frontMatterPath: `/images/${fileName}`,
    };
  } catch (error) {
    console.warn("Failed to prepare hero image for commit:", error);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== ADMIN ROUTES ====================
  
  // Create new client workspace
  app.post("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const { name, domain } = req.body;
      
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

      // Automatically create a site for this client (one-to-one relationship)
      const crypto = await import('crypto');
      const bcrypt = await import('bcryptjs');
      const { createSiteStorageBucket } = await import('./lib/supabaseStorage');
      
      // Generate a unique API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      const apiKeyHash = await bcrypt.hash(apiKey, 10);
      
      // Create site with temporary ID to get the actual UUID
      const tempSite = await storage.createSite({
        client_id: client.id,
        name: name,
        domain: domain || null,
        api_key_hash: apiKeyHash,
        storage_bucket_name: 'temp', // Will be updated after we get the UUID
      });
      
      // Create dedicated storage bucket for this site
      const { success: bucketSuccess, bucketName, error: bucketError } = await createSiteStorageBucket(tempSite.id);
      
      if (!bucketSuccess) {
        console.warn(`Failed to create storage bucket for site ${tempSite.id}:`, bucketError);
      } else {
        // Update site with the actual bucket name
        await storage.updateSite(tempSite.id, {
          storage_bucket_name: bucketName!,
        });
      }

      res.json({
        success: true,
        client,
        site: {
          id: tempSite.id,
          name: tempSite.name,
          domain: tempSite.domain,
          storage_bucket_name: bucketName,
        },
        api_key: apiKey, // Return API key only once!
        repo_url,
        message: `Client workspace and site created successfully. Save the API key - it won't be shown again!`
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

  // Create site for existing client (one-time fix endpoint)
  app.post("/api/admin/clients/:clientId/create-site", requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { domain } = req.body;

      // Check if client exists
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Check if site already exists
      const existingSites = await storage.getSitesByClientId(clientId);
      if (existingSites.length > 0) {
        return res.status(409).json({ error: "Site already exists for this client" });
      }

      // Create site with storage bucket
      const crypto = await import('crypto');
      const bcrypt = await import('bcryptjs');
      const { createSiteStorageBucket } = await import('./lib/supabaseStorage');
      
      // Generate a unique API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      const apiKeyHash = await bcrypt.hash(apiKey, 10);
      
      // Create site
      const tempSite = await storage.createSite({
        client_id: client.id,
        name: client.name,
        domain: domain || null,
        api_key_hash: apiKeyHash,
        storage_bucket_name: 'temp',
      });
      
      // Create dedicated storage bucket for this site
      const { success: bucketSuccess, bucketName, error: bucketError } = await createSiteStorageBucket(tempSite.id);
      
      if (!bucketSuccess) {
        return res.status(500).json({ 
          error: "Failed to create storage bucket",
          details: bucketError 
        });
      }

      // Update site with the actual bucket name
      await storage.updateSite(tempSite.id, {
        storage_bucket_name: bucketName!,
      });

      res.json({
        success: true,
        site: {
          id: tempSite.id,
          name: tempSite.name,
          domain: tempSite.domain,
          storage_bucket_name: bucketName,
        },
        api_key: apiKey,
        message: "Site created successfully! Save the API key - it won't be shown again!"
      });
    } catch (error) {
      console.error("Error creating site:", error);
      res.status(500).json({ 
        error: "Failed to create site",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Invite user to client workspace (creates site_member record)
  app.post("/api/admin/clients/:clientId/invite", requireAdmin, async (req, res) => {
    try {
      const { email, role = "client_editor", site_role = "editor" } = req.body;
      const clientId = parseInt(req.params.clientId);

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if client exists
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Get the site for this client (1:1 relationship)
      const sites = await storage.getSitesByClientId(clientId);
      if (sites.length === 0) {
        return res.status(404).json({ error: "No site found for this client. Please create a site first." });
      }
      const site = sites[0];

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      let isNewUser = false;

      if (user) {
        // User exists - just add them to the site
        // Keep their client_id for backwards compatibility (will be deprecated later)
        if (!user.client_id) {
          user = await storage.updateUser(user.id, {
            client_id: clientId,
            role: role as any,
          });
        }
      } else {
        // Create new user (will be able to log in after Supabase account is created)
        user = await storage.createUser({
          email,
          client_id: clientId, // For backwards compatibility
          role: role as any,
        });
        isNewUser = true;
      }

      // Check if user is already a member of this site
      const existingMembership = await storage.getSiteMemberBySiteAndUser(site.id, user.id);
      if (existingMembership) {
        // Update existing membership
        await storage.updateSiteMember(existingMembership.id, {
          role: site_role as any,
        });
      } else {
        // Create new site membership
        await storage.createSiteMember({
          site_id: site.id,
          user_id: user.id,
          role: site_role as any,
        });
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
        site: {
          id: site.id,
          name: site.name,
        },
        site_role,
        emailSent: emailResult.success,
        message: emailResult.success
          ? `User ${email} has been invited to ${client.name} (${site.name}) and an invitation email has been sent`
          : `User ${email} has been added to ${client.name} (${site.name}), but email delivery failed`
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

  // Get site for a client
  app.get("/api/admin/clients/:clientId/site", requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const sites = await storage.getSitesByClientId(clientId);
      if (sites.length === 0) {
        return res.status(404).json({ error: "No site found for this client" });
      }
      // Return the first site (should be only one due to 1:1 relationship)
      const site = sites[0];
      res.json({
        id: site.id,
        client_id: site.client_id,
        name: site.name,
        domain: site.domain,
        storage_bucket_name: site.storage_bucket_name,
        is_active: site.is_active,
        created_at: site.created_at,
        updated_at: site.updated_at
      });
    } catch (error) {
      console.error("Error fetching client site:", error);
      res.status(500).json({ error: "Failed to fetch site" });
    }
  });

  // Delete/remove user
  app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Prevent deleting the current admin user
      if (userId === req.user?.id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove all site memberships
      const memberships = await storage.getSiteMembersByUserId(userId);
      for (const membership of memberships) {
        await storage.deleteSiteMember(membership.id);
      }

      // Remove client assignment and downgrade role
      await storage.updateUser(userId, {
        client_id: null,
        role: 'client_viewer' as any
      });

      res.json({
        success: true,
        message: "User removed from all sites and workspaces"
      });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ error: "Failed to remove user" });
    }
  });

  // Change user role
  app.patch("/api/admin/users/:userId/role", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { role } = req.body;
      
      if (!role || !["admin", "client_editor", "client_viewer"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Prevent changing own role
      if (userId === req.user?.id) {
        return res.status(400).json({ error: "You cannot change your own role" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, { role: role as any });

      res.json({
        success: true,
        user: updatedUser,
        message: `User role updated to ${role}`
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
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
  
  // Get site info for user's client (for non-admin users)
  app.get("/api/client/:clientId/site", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      const requestedClientId = parseInt(req.params.clientId);
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify user has access to this client (either admin or belongs to the client)
      if (user.role !== 'admin' && user.client_id !== requestedClientId) {
        return res.status(403).json({ error: "You don't have access to this client's site" });
      }

      const sites = await storage.getSitesByClientId(requestedClientId);
      if (sites.length === 0) {
        return res.status(404).json({ error: "No site found for this client" });
      }

      // Return the first site (should be only one due to 1:1 relationship)
      const site = sites[0];
      res.json({
        id: site.id,
        name: site.name,
        domain: site.domain,
        storage_bucket_name: site.storage_bucket_name,
        is_active: site.is_active,
      });
    } catch (error) {
      console.error("Error fetching client site:", error);
      res.status(500).json({ error: "Failed to fetch site" });
    }
  });

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

      // Get site (supports both site_id and client_id for backwards compat)
      const { getSiteWithEditAccess } = await import('./lib/authorization');
      const siteId = req.body.site_id;
      const clientId = req.body.client_id || user.client_id;

      let site;
      try {
        const result = await getSiteWithEditAccess(userId, siteId, clientId);
        site = result.site;
        if (!result.canEdit) {
          return res.status(403).json({ error: "You don't have permission to create articles in this site" });
        }
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Failed to determine site"
        });
      }

      // Check monthly usage limit (per site)
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const usage = await storage.getUsageTracking(site.id, currentMonth);
      const topicsToGenerate = data.bulk_topics?.length || 1;
      const imagesToGenerate = req.body.generate_image ? topicsToGenerate : 0;

      // Check article limit
      const articlesGenerated = usage?.articles_generated || 0;
      const articleLimit = site.monthly_article_limit || 50;

      if (articlesGenerated + topicsToGenerate > articleLimit) {
        return res.status(429).json({
          error: "Monthly article limit exceeded",
          message: `You can only generate ${articleLimit - articlesGenerated} more articles this month (limit: ${articleLimit})`
        });
      }

      // Check image limit if generating images
      if (req.body.generate_image) {
        const imagesGenerated = usage?.images_generated || 0;
        const imageLimit = site.monthly_image_limit || 100;

        if (imagesGenerated + imagesToGenerate > imageLimit) {
          return res.status(429).json({
            error: "Monthly image limit exceeded",
            message: `You can only generate ${imageLimit - imagesGenerated} more images this month (limit: ${imageLimit})`
          });
        }
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
            
            heroImageDescription = imagePrompt;
            
            try {
              // Import image generation functions
              const { generateImage } = await import('./lib/openai');
              const { downloadAndUploadImage } = await import('./lib/supabaseStorage');
              
              // Generate image with DALL-E
              const generatedImage = await generateImage(imagePrompt);
              
              // Upload to site's storage bucket
              if (site && site.storage_bucket_name) {
                // Download and upload to site's bucket
                const uploadResult = await downloadAndUploadImage(
                  generatedImage.url,
                  site.storage_bucket_name,
                  `hero-${Date.now()}.png`
                );

                if (uploadResult.success) {
                  heroImageUrl = uploadResult.url!;
                } else {
                  console.warn('Failed to upload image:', uploadResult.error);
                  // Fall back to temporary DALL-E URL
                  heroImageUrl = generatedImage.url;
                }
              } else {
                // No site bucket, use temporary DALL-E URL
                heroImageUrl = generatedImage.url;
              }
            } catch (error) {
              console.error('Failed to generate hero image:', error);
              // Continue without image
            }
          }
          
          const createdArticle = await storage.createArticle({
            user_id: userId,
            site_id: site.id,
            client_id: site.client_id, // Backwards compat
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
          if (req.body.commit_to_repo) {
            const client = await storage.getClient(site.client_id);
            if (client && client.repo_url) {
              const heroImageData = await prepareHeroImageForCommit(createdArticle);
              const commitResult = await githubService.commitPost(
                client,
                createdArticle,
                heroImageData ?? undefined
              );
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
              
              try {
                // Import image generation functions
                const { generateImage } = await import('./lib/openai');
                const { downloadAndUploadImage } = await import('./lib/supabaseStorage');
                
                // Generate image with DALL-E
                const generatedImage = await generateImage(imagePrompt);
                
                // Upload to site's storage bucket
                if (site && site.storage_bucket_name) {
                  // Download and upload to site's bucket
                  const uploadResult = await downloadAndUploadImage(
                    generatedImage.url,
                    site.storage_bucket_name,
                    `hero-${Date.now()}-${articles.indexOf(article)}.png`
                  );

                  if (uploadResult.success) {
                    heroImageUrl = uploadResult.url!;
                  } else {
                    console.warn('Failed to upload image:', uploadResult.error);
                    // Fall back to temporary DALL-E URL
                    heroImageUrl = generatedImage.url;
                  }
                } else {
                  // No site bucket, use temporary DALL-E URL
                  heroImageUrl = generatedImage.url;
                }
              } catch (error) {
                console.error('Failed to generate hero image:', error);
                // Continue without image
              }
            }
            
            const createdArticle = await storage.createArticle({
              user_id: userId,
              site_id: site.id,
              client_id: site.client_id, // Backwards compat
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
            if (req.body.commit_to_repo) {
              const client = await storage.getClient(site.client_id);
              if (client && client.repo_url) {
                const heroImageData = await prepareHeroImageForCommit(createdArticle);
                const commitResult = await githubService.commitPost(
                  client,
                  createdArticle,
                  heroImageData ?? undefined
                );
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

      // Update usage tracking (per site)
      if (generatedCount > 0) {
        const actualImagesGenerated = req.body.generate_image ? generatedCount : 0;
        await storage.updateUsageTracking(site.id, currentMonth, generatedCount, actualImagesGenerated);
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

  // Get user articles (with site-based filtering)
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

      const { getUserSites } = await import('./lib/authorization');

      let articles: any[];
      if (user.role === "admin") {
        // Admin can see all articles or filter by site/client
        const siteId = req.query.site_id as string;
        const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;

        if (siteId) {
          articles = await storage.getArticlesBySiteId(siteId);
        } else if (clientId) {
          articles = await storage.getArticlesByClientId(clientId);
        } else {
          articles = await storage.getAllArticles();
        }
      } else {
        // Regular users see articles from their sites
        const userSites = await getUserSites(userId);
        const siteIds = userSites.map(s => s.id);
        articles = await storage.getArticlesBySiteIds(siteIds);
      }

      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  // Update article (with site-based access control)
  app.put("/api/articles/:id", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const articleId = parseInt(req.params.id);
      const updateData = req.body;

      // Verify article exists
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Check edit permission
      const { canEditArticle } = await import('./lib/authorization');
      if (!(await canEditArticle(userId, articleId))) {
        return res.status(403).json({ error: "You don't have permission to edit this article" });
      }

      const updatedArticle = await storage.updateArticle(articleId, updateData);

      // Commit to GitHub if requested and status changed to published
      if (updateData.status === "published" && req.body.commit_to_repo && article.site_id) {
        const site = await storage.getSite(article.site_id);
        if (site) {
          const client = await storage.getClient(site.client_id);
          if (client && client.repo_url) {
            const heroImageData = await prepareHeroImageForCommit(updatedArticle);
            await githubService.commitPost(
              client,
              updatedArticle,
              heroImageData ?? undefined
            );
          }
        }
      }

      res.json(updatedArticle);
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Delete article (with site-based access control)
  app.delete("/api/articles/:id", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const articleId = parseInt(req.params.id);

      // Verify article exists
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Check edit permission (delete requires edit access)
      const { canEditArticle } = await import('./lib/authorization');
      if (!(await canEditArticle(userId, articleId))) {
        return res.status(403).json({ error: "You don't have permission to delete this article" });
      }

      await storage.deleteArticle(articleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Regenerate article hero image with custom prompt
  app.post("/api/articles/:id/regenerate-image", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const articleId = parseInt(req.params.id);
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: "Image prompt is required" });
      }

      // Verify article exists
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Check edit permission
      const { canEditArticle } = await import('./lib/authorization');
      if (!(await canEditArticle(userId, articleId))) {
        return res.status(403).json({ error: "You don't have permission to edit this article" });
      }

      // Get the site to access storage bucket
      if (!article.site_id) {
        return res.status(400).json({ error: "Article is not associated with a site" });
      }

      const site = await storage.getSite(article.site_id);
      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      // Generate new image with DALL-E
      const { generateImage } = await import('./lib/openai');
      const { downloadAndUploadImage } = await import('./lib/supabaseStorage');

      const generatedImage = await generateImage(prompt.trim());

      let newImageUrl = generatedImage.url;

      // Upload to site's storage bucket
      if (site.storage_bucket_name) {
        const uploadResult = await downloadAndUploadImage(
          generatedImage.url,
          site.storage_bucket_name,
          `hero-${Date.now()}.png`
        );

        if (uploadResult.success) {
          newImageUrl = uploadResult.url!;
        } else {
          console.warn('Failed to upload regenerated image:', uploadResult.error);
          // Fall back to temporary DALL-E URL
        }
      }

      // Update article with new image
      const updatedArticle = await storage.updateArticle(articleId, {
        featured_image: newImageUrl
      });

      res.json({
        success: true,
        featured_image: newImageUrl,
        article: updatedArticle
      });
    } catch (error) {
      console.error("Error regenerating article image:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to regenerate image"
      });
    }
  });

  // Export article as ZIP (markdown + images)
  app.get("/api/articles/:id/export", requireClientAccess, async (req, res) => {
    try {
      const archiver = (await import('archiver')).default;
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
      if (user.role !== "admin" && article.client_id !== user.client_id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Use remark to parse markdown and extract all images robustly
      const { remark } = await import('remark');
      const remarkParse = (await import('remark-parse')).default;
      const { visit } = await import('unist-util-visit');
      
      const imageMap = new Map<string, string>();
      const definitions = new Map<string, string>();
      let imageCounter = 1;
      
      // Parse the markdown AST
      const processor = remark().use(remarkParse);
      const tree = processor.parse(article.content);
      
      // First pass: collect all definitions for reference-style images
      visit(tree, 'definition', (node: any) => {
        if (node.identifier && node.url) {
          definitions.set(node.identifier, node.url);
        }
      });
      
      // Second pass: visit all image nodes (both inline and reference-style)
      visit(tree, ['image', 'imageReference'], (node: any) => {
        let url = node.url;
        
        // For reference-style images, resolve the URL from definitions
        if (node.type === 'imageReference' && node.identifier) {
          url = definitions.get(node.identifier);
          if (!url) return; // Skip if definition not found
        }
        
        if (url && !imageMap.has(url)) {
          const ext = url.split('.').pop()?.split('?')[0] || 'png';
          const localName = `image-${imageCounter}.${ext}`;
          imageMap.set(url, localName);
          // Update the node's URL to local reference
          if (node.type === 'image') {
            node.url = localName;
          } else if (node.type === 'imageReference') {
            // Convert reference to inline image with local URL
            node.type = 'image';
            node.url = localName;
            delete node.identifier;
            delete node.referenceType;
          }
          imageCounter++;
        } else if (url && imageMap.has(url)) {
          // Reuse existing mapping for duplicate images
          const localName = imageMap.get(url)!;
          if (node.type === 'image') {
            node.url = localName;
          } else if (node.type === 'imageReference') {
            // Convert reference to inline image
            node.type = 'image';
            node.url = localName;
            delete node.identifier;
            delete node.referenceType;
          }
        }
      });
      
      // Serialize the AST back to markdown
      const remarkStringify = (await import('remark-stringify')).default;
      const { unified } = await import('unified');
      const stringifyProcessor = unified().use(remarkStringify);
      const processedContent = stringifyProcessor.stringify(tree);

      const frontmatter = [
        '---',
        `title: "${article.title.replace(/"/g, '\\"')}"`,
        `slug: ${article.slug}`,
        article.meta_description ? `description: "${article.meta_description.replace(/"/g, '\\"')}"` : null,
        article.keywords && article.keywords.length > 0 ? `keywords: [${article.keywords.map(k => `"${k}"`).join(', ')}]` : null,
        `status: ${article.status}`,
        `created: ${article.created_at}`,
        article.hero_image_url ? `hero_image: hero.png` : null,
        '---',
        ''
      ].filter(Boolean).join('\n');

      const markdown = frontmatter + processedContent;

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      const filename = `${article.slug || `article-${article.id}`}.zip`;

      res.attachment(filename);
      archive.pipe(res);

      // Add markdown file
      archive.append(markdown, { name: `${article.slug || `article-${article.id}`}.md` });

      // Download and add hero image if it exists
      if (article.hero_image_url) {
        try {
          const imageResponse = await fetch(article.hero_image_url);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            archive.append(imageBuffer, { name: 'hero.png' });
          }
        } catch (error) {
          console.warn('Failed to download hero image for export:', error);
        }
      }

      // Download and add all embedded images
      for (const entry of Array.from(imageMap.entries())) {
        const [url, localName] = entry;
        try {
          const imageResponse = await fetch(url);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            archive.append(imageBuffer, { name: localName });
          }
        } catch (error) {
          console.warn(`Failed to download embedded image ${url}:`, error);
        }
      }

      archive.finalize();
    } catch (error) {
      console.error("Error exporting article:", error);
      res.status(500).json({ error: "Failed to export article" });
    }
  });

  // Update article scheduled date
  app.patch("/api/articles/:id/schedule", requireClientAccess, async (req, res) => {
    try {
      const userId = req.user?.id;
      const articleId = parseInt(req.params.id);
      const { scheduled_date } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check that scheduled_date field is present in request (can be null to clear)
      if (!req.body.hasOwnProperty('scheduled_date')) {
        return res.status(400).json({ error: "scheduled_date field is required" });
      }

      // Get the article
      const article = await storage.getArticle(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Get user to check client_id
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check authorization - user must be admin or belong to the same client
      if (user.role !== 'admin' && article.client_id !== user.client_id) {
        return res.status(403).json({ error: "Forbidden - access denied" });
      }

      // Update the scheduled_date (null to clear, date to set)
      const updateData: any = {
        scheduled_date: scheduled_date ? new Date(scheduled_date) : null,
      };
      
      // Update status based on scheduled_date
      if (scheduled_date) {
        updateData.status = 'scheduled' as const;
      } else {
        // If clearing schedule, revert to draft
        updateData.status = 'draft' as const;
      }

      const updatedArticle = await storage.updateArticle(articleId, updateData);

      res.json(updatedArticle);
    } catch (error) {
      console.error("Error updating article schedule:", error);
      res.status(500).json({ error: "Failed to update article schedule" });
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

      const user = await storage.getUser(userId);
      if (!user || !user.client_id) {
        return res.json({
          count: 0,
          limit: 50,
          month: new Date().toISOString().substring(0, 7)
        });
      }

      // Get the user's primary site
      const { getUserSites } = await import('./lib/authorization');
      const userSites = await getUserSites(userId);

      if (userSites.length === 0) {
        return res.json({
          count: 0,
          limit: 50,
          month: new Date().toISOString().substring(0, 7)
        });
      }

      // Use the first site (primary site)
      const site = userSites[0];
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usage = await storage.getUsageTracking(site.id, currentMonth);

      res.json({
        count: usage?.articles_generated || 0,
        limit: site.monthly_article_limit || 50,
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
