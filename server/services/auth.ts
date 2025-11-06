import type { Request, Response, NextFunction } from 'express';
import { getStorage } from '../storage';
import { supabaseAdmin } from '../lib/supabaseAdmin';

// Shared Supabase admin client (null when credentials missing)
const supabase = supabaseAdmin;

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 */
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Public routes that don't require authentication
    const publicRoutes = [
      '/api/invitations/validate/',
      '/api/invitations/accept',
    ];

    // Express removes the mount path (/api) from req.path, so rebuild full path for matching
    const requestPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    // Check if this is a public route
    const isPublicRoute = publicRoutes.some(route => requestPath.startsWith(route) || requestPath === route);
    if (isPublicRoute) {
      return next();
    }

    // If Supabase is not configured, return error
    if (!supabase) {
      return res.status(500).json({ error: 'Authentication service not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
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
      // SECURITY: Do NOT auto-create users!
      // Users must be invited by an admin first
      console.warn(`Unauthorized login attempt by ${supabaseUser.email}`);
      return res.status(403).json({
        error: 'Account not found. You must be invited by an administrator to access this application.'
      });
    }

    // Sync supabase_user_id if not already set (for existing users)
    if (!dbUser.supabase_user_id) {
      dbUser = await storage.updateUser(dbUser.id, {
        supabase_user_id: supabaseUser.id,
      });
    }

    // Get user's site memberships for authorization context
    const siteMemberships = await storage.getSiteMembersByUserId(dbUser.id);

    // Attach user to request with site access info
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      supabase_user_id: supabaseUser.id,
      site_memberships: siteMemberships.map(sm => ({
        site_id: sm.site_id,
        role: sm.role,
      })),
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
