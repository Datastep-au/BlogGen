import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getStorage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'bloggen-api';

// Extend Express Request to include siteId
declare global {
  namespace Express {
    interface Request {
      siteId?: string;
    }
  }
}

export interface SiteJWTPayload {
  site_id: string;
  domain?: string;
  iss: string;
  iat: number;
  exp: number;
}

export function generateApiKey(): string {
  return `bgn_${crypto.randomBytes(32).toString('hex')}`;
}

export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, 10);
}

export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

export function generateSiteJWT(siteId: string, domain?: string): string {
  const payload: SiteJWTPayload = {
    site_id: siteId,
    domain,
    iss: JWT_ISSUER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
  };

  return jwt.sign(payload, JWT_SECRET);
}

export function verifySiteJWT(token: string): SiteJWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER
    }) as SiteJWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate API requests using Bearer token
export async function authenticateApiRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  const payload = verifySiteJWT(token);

  if (!payload) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or expired token' 
    });
  }

  // Verify site exists and is active
  const storage = await getStorage();
  const site = await storage.getSite(payload.site_id);

  if (!site || !site.is_active) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Site not found or inactive' 
    });
  }

  req.siteId = payload.site_id;
  next();
}

// Rate limiting map (in-memory for now, could use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 60, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.siteId || req.ip || 'unknown';
    const now = Date.now();
    
    const limitData = rateLimitMap.get(key);
    
    if (!limitData || now > limitData.resetTime) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      return next();
    }
    
    if (limitData.count >= maxRequests) {
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((limitData.resetTime - now) / 1000)
      });
    }
    
    limitData.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - limitData.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());
    next();
  };
}
