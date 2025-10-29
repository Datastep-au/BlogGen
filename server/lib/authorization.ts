/**
 * Authorization helpers for site-based access control
 *
 * This module provides utilities for checking user permissions based on:
 * - User role (admin, client_editor, client_viewer)
 * - Site membership (via site_members table)
 * - Site role (owner, editor, viewer)
 */

import type { Request, Response } from 'express';
import { storage } from '../storage';
import type { User, Site, SiteMember } from '@shared/schema';

export interface AuthorizedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role?: string;
    supabase_user_id?: string;
    site_memberships?: Array<{
      site_id: string;
      role: string;
    }>;
  };
}

/**
 * Check if user is an admin
 */
export async function isAdmin(userId: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  return user?.role === 'admin';
}

/**
 * Check if user has access to a specific site
 */
export async function hasSiteAccess(userId: number, siteId: string): Promise<boolean> {
  // Admins have access to all sites
  if (await isAdmin(userId)) {
    return true;
  }

  // Check site membership
  const membership = await storage.getSiteMemberBySiteAndUser(siteId, userId);
  return !!membership;
}

/**
 * Check if user can edit content in a site (owner or editor role)
 */
export async function canEditSite(userId: number, siteId: string): Promise<boolean> {
  // Admins can edit all sites
  if (await isAdmin(userId)) {
    return true;
  }

  // Check if user is owner or editor
  const membership = await storage.getSiteMemberBySiteAndUser(siteId, userId);
  return membership?.role === 'owner' || membership?.role === 'editor';
}

/**
 * Get the site ID for a client (1:1 relationship)
 * Returns the first site associated with the client
 */
export async function getSiteIdForClient(clientId: number): Promise<string | null> {
  const sites = await storage.getSitesByClientId(clientId);
  return sites.length > 0 ? sites[0].id : null;
}

/**
 * Get all sites a user has access to
 */
export async function getUserSites(userId: number): Promise<Site[]> {
  // Admins see all sites
  if (await isAdmin(userId)) {
    return await storage.getAllSites();
  }

  // Get sites via membership
  const memberships = await storage.getSiteMembersByUserId(userId);
  const siteIds = memberships.map(m => m.site_id);

  const sites: Site[] = [];
  for (const siteId of siteIds) {
    const site = await storage.getSite(siteId);
    if (site) {
      sites.push(site);
    }
  }

  return sites;
}

/**
 * Middleware: Require admin role
 */
export async function requireAdmin(req: AuthorizedRequest, res: Response, next: any) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await storage.getUser(req.user.id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Middleware: Require site access (either admin or site member)
 * Expects siteId in req.params or req.body
 */
export async function requireSiteAccess(req: AuthorizedRequest, res: Response, next: any) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const siteId = req.params.siteId || req.body.site_id;
  if (!siteId) {
    return res.status(400).json({ error: 'Site ID is required' });
  }

  if (!(await hasSiteAccess(req.user.id, siteId))) {
    return res.status(403).json({ error: 'Access denied to this site' });
  }

  next();
}

/**
 * Middleware: Require edit permissions for a site
 * Expects siteId in req.params or req.body
 */
export async function requireSiteEdit(req: AuthorizedRequest, res: Response, next: any) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const siteId = req.params.siteId || req.body.site_id;
  if (!siteId) {
    return res.status(400).json({ error: 'Site ID is required' });
  }

  if (!(await canEditSite(req.user.id, siteId))) {
    return res.status(403).json({ error: 'Edit access denied for this site' });
  }

  next();
}

/**
 * Get site ID from article
 */
export async function getSiteIdFromArticle(articleId: number): Promise<string | null> {
  const article = await storage.getArticle(articleId);
  return article?.site_id || null;
}

/**
 * Check if user can access an article (via site membership)
 */
export async function canAccessArticle(userId: number, articleId: number): Promise<boolean> {
  const siteId = await getSiteIdFromArticle(articleId);
  if (!siteId) return false;

  return await hasSiteAccess(userId, siteId);
}

/**
 * Check if user can edit an article (via site membership with editor/owner role)
 */
export async function canEditArticle(userId: number, articleId: number): Promise<boolean> {
  const siteId = await getSiteIdFromArticle(articleId);
  if (!siteId) return false;

  return await canEditSite(userId, siteId);
}
