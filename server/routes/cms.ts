import { Router, Request, Response } from 'express';
import { getStorage } from '../storage';
import { authenticateApiRequest, rateLimit } from '../lib/apiAuth';
import crypto from 'crypto';

const router = Router();

// Apply authentication and rate limiting to all CMS API routes
router.use(authenticateApiRequest);
router.use(rateLimit(60, 60000)); // 60 requests per minute

// Health check endpoint
router.get('/sites/:siteId/health', async (req: Request, res: Response) => {
  try {
    if (req.params.siteId !== req.siteId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ok: true,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get posts for a site
router.get('/sites/:siteId/posts', async (req: Request, res: Response) => {
  try {
    if (req.params.siteId !== req.siteId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storage = await getStorage();
    const {
      status = 'published',
      updated_since,
      limit = '50',
      cursor
    } = req.query;

    const updatedSince = updated_since ? new Date(updated_since as string) : undefined;
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    const { posts, nextCursor } = await storage.getPostsBySiteId(
      req.params.siteId,
      status as string,
      updatedSince,
      limitNum,
      cursor as string | undefined
    );

    // Get previous slugs for each post
    const postsWithMetadata = await Promise.all(
      posts.map(async (post) => {
        const previousSlugs = await storage.getPostSlugs(post.id);
        const images = await storage.getAssetsByPostId(post.id);

        return {
          id: post.id,
          site_id: post.site_id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body_html: post.body_html,
          tags: post.tags,
          cover_image_url: post.cover_image_url,
          meta_title: post.meta_title,
          meta_description: post.meta_description,
          og_image_url: post.og_image_url,
          canonical_url: post.canonical_url,
          noindex: post.noindex,
          status: post.status,
          published_at: post.published_at,
          updated_at: post.updated_at,
          images: images.map(img => ({
            url: img.url,
            alt: img.alt,
            w: img.width,
            h: img.height,
            role: img.role
          })),
          previous_slugs: previousSlugs.map(ps => ps.slug).filter(s => s !== post.slug),
          content_hash: post.content_hash
        };
      })
    );

    const responseBody = {
      items: postsWithMetadata,
      next_cursor: nextCursor,
      last_sync: new Date().toISOString()
    };

    // Generate ETag
    const etag = generateETag(responseBody);
    
    // Check If-None-Match header
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(responseBody);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single post by slug
router.get('/sites/:siteId/posts/:slug', async (req: Request, res: Response) => {
  try {
    if (req.params.siteId !== req.siteId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storage = await getStorage();
    const post = await storage.getPostBySlug(req.params.siteId, req.params.slug);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const previousSlugs = await storage.getPostSlugs(post.id);
    const images = await storage.getAssetsByPostId(post.id);

    const responseBody = {
      id: post.id,
      site_id: post.site_id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      body_html: post.body_html,
      tags: post.tags,
      cover_image_url: post.cover_image_url,
      meta_title: post.meta_title,
      meta_description: post.meta_description,
      og_image_url: post.og_image_url,
      canonical_url: post.canonical_url,
      noindex: post.noindex,
      status: post.status,
      published_at: post.published_at,
      updated_at: post.updated_at,
      images: images.map(img => ({
        url: img.url,
        alt: img.alt,
        w: img.width,
        h: img.height,
        role: img.role
      })),
      previous_slugs: previousSlugs.map(ps => ps.slug).filter(s => s !== post.slug),
      content_hash: post.content_hash
    };

    // Generate ETag
    const etag = generateETag(responseBody);
    
    // Check If-None-Match header
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(responseBody);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateETag(data: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(data));
  return `"${hash.digest('hex').substring(0, 32)}"`;
}

export default router;
