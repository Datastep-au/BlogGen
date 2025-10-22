import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';
import { getStorage } from '../storage';

// Initialize Supabase client for server-side auth verification
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

// Only create Supabase client if we have valid credentials
const supabase = (supabaseUrl !== 'https://placeholder.supabase.co' && supabaseServiceKey !== 'placeholder-key')
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 */
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // For development, allow mock user if no auth header
    if (process.env.NODE_ENV === 'development' && !req.headers.authorization) {
      // Check if we have a test admin user
      const storage = await getStorage();
      let testUser = await storage.getUserByEmail('admin@bloggen.com');
      
      if (!testUser) {
        // Create test admin user
        testUser = await storage.createUser({
          email: 'admin@bloggen.com',
          full_name: 'Test Admin',
          role: 'admin',
        });
      }
      
      req.user = { id: testUser.id, email: testUser.email };
      return next();
    }

    // If Supabase is not configured, skip token verification in development
    if (!supabase) {
      // Use development mock user
      const storage = await getStorage();
      let testUser = await storage.getUserByEmail('admin@bloggen.com');
      
      if (!testUser) {
        // Create test admin user
        testUser = await storage.createUser({
          email: 'admin@bloggen.com',
          full_name: 'Test Admin',
          role: 'admin',
        });
      }
      
      req.user = { id: testUser.id, email: testUser.email };
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user exists in our database
    const storage = await getStorage();
    let dbUser = await storage.getUserByEmail(supabaseUser.email || '');

    if (!dbUser) {
      // Create user if they don't exist (first time login)
      dbUser = await storage.createUser({
        email: supabaseUser.email || '',
        full_name: supabaseUser.user_metadata?.full_name || null,
        avatar_url: supabaseUser.user_metadata?.avatar_url || null,
        role: 'client_editor', // Default role for new users
      });
    }

    // Attach user to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware for API routes that require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}