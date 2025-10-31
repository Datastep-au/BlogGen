// Load environment variables first
import './env';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { authenticateRequest } from "./services/auth";
import { initializeStorageBucket } from "./lib/supabaseStorage";
import { startJobProcessor } from "./lib/jobProcessor";

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string };
    }
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from attached_assets directory
app.use('/attached_assets', express.static('attached_assets'));

// Authentication middleware for API routes
app.use('/api', authenticateRequest);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await initializeStorageBucket();
  } catch (error) {
    console.error('⚠️ Failed to initialize storage bucket:', error instanceof Error ? error.message : String(error));
    console.error('Storage operations may fail. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  try {
    console.log('🔍 Checking for clients without sites...');
    // Automatically create sites for clients that don't have one
    const { getStorage } = await import('./storage');
    const { createSiteStorageBucket } = await import('./lib/supabaseStorage');
    const crypto = await import('crypto');
    const bcrypt = await import('bcryptjs');
    
    const storage = await getStorage();
    const clients = await storage.getAllClients();
    console.log(`📊 Found ${clients.length} client(s)`);
    
    for (const client of clients) {
      const sites = await storage.getSitesByClientId(client.id);
      console.log(`📍 Client "${client.name}" has ${sites.length} site(s)`);
      
      if (sites.length === 0) {
        console.log(`🔧 Creating site for client "${client.name}" (ID: ${client.id})...`);
        
        try {
          // Generate a unique API key
          const apiKey = crypto.randomBytes(32).toString('hex');
          const apiKeyHash = await bcrypt.hash(apiKey, 10);
          
          // Create site
          const tempSite = await storage.createSite({
            client_id: client.id,
            name: client.name,
            domain: null,
            api_key_hash: apiKeyHash,
            storage_bucket_name: 'temp',
          });
          
          console.log(`📦 Creating storage bucket for site ${tempSite.id}...`);
          // Create dedicated storage bucket for this site
          const { success: bucketSuccess, bucketName, error: bucketError } = await createSiteStorageBucket(tempSite.id);
          
          if (bucketSuccess) {
            // Update site with the actual bucket name
            await storage.updateSite(tempSite.id, {
              storage_bucket_name: bucketName!,
            });
            console.log(`✅ Site created for client "${client.name}" with bucket: ${bucketName}`);
          } else {
            console.warn(`⚠️ Failed to create storage bucket for site ${tempSite.id}:`, bucketError);
          }
        } catch (error) {
          console.error(`❌ Failed to create site for client "${client.name}":`, error);
        }
      }
    }
    console.log('✅ Site check completed');
  } catch (error) {
    console.error('⚠️ Failed to auto-create sites:');
    console.error(error);
  }
  
  try {
    // Start job processor for webhooks and scheduled posts (check every minute)
    await startJobProcessor(60000);
  } catch (error) {
    console.error('⚠️ Failed to start job processor:', error instanceof Error ? error.message : String(error));
    console.error('Scheduled jobs and webhooks may not be processed.');
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || "127.0.0.1"; // Use localhost for development
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
