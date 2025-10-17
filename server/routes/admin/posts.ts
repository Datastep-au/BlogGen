import { Router } from 'express';
import { getStorage } from '../../storage';
import { generateContentHash, renderMarkdownToHtml, slugify, deduplicateSlug } from '../../lib/contentHash';
import { emitWebhookEvent } from '../../lib/webhooks';
import { uploadImage } from '../../lib/supabaseStorage';

const router = Router();

// Publish article to CMS as a post
router.post('/publish', async (req, res) => {
  try {
    const storage = await getStorage();
    const {
      site_id,
      article_id,
      status = 'draft',
      scheduled_date,
      generate_og_image = false
    } = req.body;

    if (!site_id || !article_id) {
      return res.status(400).json({ error: 'site_id and article_id are required' });
    }

    // Get the article
    const article = await storage.getArticle(article_id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get the site
    const site = await storage.getSite(site_id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Generate slug from title
    const baseSlug = slugify(article.title);
    
    // Get existing posts to check for duplicate slugs
    const { posts: existingPosts } = await storage.getPostsBySiteId(site_id, undefined, undefined, 1000);
    const existingSlugs = existingPosts.map(p => p.slug);
    const uniqueSlug = deduplicateSlug(baseSlug, existingSlugs);

    // Render markdown to HTML
    const bodyHtml = await renderMarkdownToHtml(article.content);

    // Generate content hash
    const contentHash = generateContentHash({
      siteId: site_id,
      slug: uniqueSlug,
      title: article.title,
      bodyMd: article.content,
      metaTitle: article.title,
      metaDescription: article.meta_description,
      tags: article.keywords || []
    });

    // Determine publish status and date
    const postStatus = status === 'scheduled' && scheduled_date ? 'scheduled' : status;
    const publishedAt = status === 'published' ? new Date() : 
                       (status === 'scheduled' && scheduled_date ? new Date(scheduled_date) : null);

    // Create the post
    const post = await storage.createPost({
      site_id,
      title: article.title,
      slug: uniqueSlug,
      excerpt: article.excerpt || article.meta_description?.substring(0, 200) || null,
      body_md: article.content,
      body_html: bodyHtml,
      tags: article.keywords || [],
      cover_image_url: article.cover_image_url,
      meta_title: article.title,
      meta_description: article.meta_description,
      og_image_url: article.hero_image_url || article.cover_image_url,
      canonical_url: site.domain ? `https://${site.domain}/blog/${uniqueSlug}` : null,
      noindex: false,
      status: postStatus as any,
      published_at: publishedAt,
      content_hash: contentHash
    });

    // If post has images, create asset records
    if (article.hero_image_url) {
      await storage.createAsset({
        site_id,
        post_id: post.id,
        url: article.hero_image_url,
        alt: article.hero_image_description || article.title,
        role: 'hero'
      });
    }

    if (article.cover_image_url && article.cover_image_url !== article.hero_image_url) {
      await storage.createAsset({
        site_id,
        post_id: post.id,
        url: article.cover_image_url,
        alt: article.title,
        role: 'cover'
      });
    }

    // If publishing immediately, emit webhook
    if (status === 'published') {
      await emitWebhookEvent({
        event: 'post_published',
        site_id,
        post_id: post.id,
        slug: post.slug,
        updated_at: new Date().toISOString(),
        content_hash: contentHash
      });
    }

    // If scheduled, create a scheduled job
    if (status === 'scheduled' && publishedAt) {
      await storage.createScheduledJob({
        job_type: 'publish_scheduled_post',
        payload: { post_id: post.id },
        scheduled_for: publishedAt,
        max_attempts: 3
      });
    }

    res.json({
      success: true,
      post,
      message: status === 'published' ? 'Post published successfully' : 
              status === 'scheduled' ? `Post scheduled for ${publishedAt?.toISOString()}` :
              'Post saved as draft'
    });
  } catch (error) {
    console.error('Error publishing article to CMS:', error);
    res.status(500).json({ error: 'Failed to publish article' });
  }
});

// Update existing post
router.put('/:postId', async (req, res) => {
  try {
    const storage = await getStorage();
    const {
      title,
      slug: newSlug,
      body_md,
      excerpt,
      tags,
      meta_title,
      meta_description,
      status,
      published_at
    } = req.body;

    const post = await storage.getPost(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updates: any = {};

    // Track if slug changed for redirect
    let previousSlug: string | undefined;

    if (newSlug && newSlug !== post.slug) {
      // Check if new slug is unique
      const { posts: existingPosts } = await storage.getPostsBySiteId(post.site_id);
      const existingSlugs = existingPosts.filter(p => p.id !== post.id).map(p => p.slug);
      
      if (existingSlugs.includes(newSlug)) {
        return res.status(409).json({ error: 'Slug already exists' });
      }

      previousSlug = post.slug;
      updates.slug = newSlug;

      // Add old slug to history
      await storage.createPostSlug({
        post_id: post.id,
        slug: post.slug
      });
    }

    if (title) updates.title = title;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (tags) updates.tags = tags;
    if (meta_title) updates.meta_title = meta_title;
    if (meta_description) updates.meta_description = meta_description;
    if (status) updates.status = status;
    if (published_at) updates.published_at = new Date(published_at);

    if (body_md) {
      updates.body_md = body_md;
      updates.body_html = await renderMarkdownToHtml(body_md);
    }

    // Regenerate content hash
    if (title || newSlug || body_md || meta_title || meta_description || tags) {
      updates.content_hash = generateContentHash({
        siteId: post.site_id,
        slug: newSlug || post.slug,
        title: title || post.title,
        bodyMd: body_md || post.body_md,
        metaTitle: meta_title || post.meta_title,
        metaDescription: meta_description || post.meta_description,
        tags: tags || post.tags || []
      });
    }

    const updatedPost = await storage.updatePost(req.params.postId, updates);

    // Emit webhook for update
    await emitWebhookEvent({
      event: 'post_updated',
      site_id: post.site_id,
      post_id: post.id,
      slug: updatedPost.slug,
      previous_slug: previousSlug,
      updated_at: new Date().toISOString(),
      content_hash: updatedPost.content_hash
    });

    res.json({
      success: true,
      post: updatedPost,
      message: 'Post updated successfully'
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:postId', async (req, res) => {
  try {
    const storage = await getStorage();
    const post = await storage.getPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Emit webhook before deletion
    await emitWebhookEvent({
      event: 'post_deleted',
      site_id: post.site_id,
      post_id: post.id,
      slug: post.slug,
      updated_at: new Date().toISOString(),
      content_hash: post.content_hash
    });

    await storage.deletePost(req.params.postId);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get posts for a site (admin view)
router.get('/site/:siteId', async (req, res) => {
  try {
    const storage = await getStorage();
    const { status, limit = '50', cursor } = req.query;

    const { posts, nextCursor } = await storage.getPostsBySiteId(
      req.params.siteId,
      status as string | undefined,
      undefined,
      parseInt(limit as string, 10),
      cursor as string | undefined
    );

    res.json({
      posts,
      next_cursor: nextCursor
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

export default router;
