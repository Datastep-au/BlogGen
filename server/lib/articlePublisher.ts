import { getStorage } from '../storage';
import { generateContentHash, renderMarkdownToHtml, slugify, deduplicateSlug } from './contentHash';
import type { Article, Post } from '../../shared/schema';

export interface PublishOptions {
  status?: 'draft' | 'published' | 'scheduled';
  publishedAt?: Date;
}

/**
 * Publishes an article to the headless CMS as a post
 * This is a reusable function that can be called from:
 * - Manual publish endpoint (POST /api/admin/posts/publish)
 * - Job processor (automatic scheduled publishing)
 *
 * @param article The article to publish
 * @param siteId The site ID to publish to
 * @param options Optional publishing options (status, publishedAt)
 * @returns The created post object
 */
export async function publishArticleToCMS(
  article: Article,
  siteId: string,
  options: PublishOptions = {}
): Promise<Post> {
  const storage = await getStorage();

  // Get the site
  const site = await storage.getSite(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  // Generate unique slug from title
  const baseSlug = slugify(article.title);

  // Get existing posts to check for duplicate slugs
  const { posts: existingPosts } = await storage.getPostsBySiteId(siteId, undefined, undefined, 1000);
  const existingSlugs = existingPosts.map(p => p.slug);
  const uniqueSlug = deduplicateSlug(baseSlug, existingSlugs);

  // Render markdown to HTML
  const bodyHtml = await renderMarkdownToHtml(article.content);

  // Generate content hash for versioning
  const contentHash = generateContentHash({
    siteId,
    slug: uniqueSlug,
    title: article.title,
    bodyMd: article.content,
    metaTitle: article.title,
    metaDescription: article.meta_description,
    tags: article.keywords || []
  });

  // Determine publish status and date
  const postStatus = options.status || 'published';
  const publishedAt = options.publishedAt || (postStatus === 'published' ? new Date() : null);

  // Create the post in CMS
  const post = await storage.createPost({
    site_id: siteId,
    title: article.title,
    slug: uniqueSlug,
    excerpt: article.excerpt || article.meta_description?.substring(0, 200) || null,
    content: article.content, // Legacy column
    body_md: article.content,
    body_html: bodyHtml,
    tags: article.keywords || [],
    cover_image_url: article.hero_image_url || article.cover_image_url,
    meta_title: article.title,
    meta_description: article.meta_description,
    og_image_url: article.hero_image_url || article.cover_image_url,
    canonical_url: site.domain ? `https://${site.domain}/blog/${uniqueSlug}` : null,
    noindex: false,
    status: postStatus as any,
    published_at: publishedAt,
    content_hash: contentHash
  });

  // Note: Asset records creation skipped due to schema mismatch
  // The database assets table has a different structure (file storage)
  // Images are already referenced in post.cover_image_url and post.og_image_url

  return post;
}
