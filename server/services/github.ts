import { Octokit } from "@octokit/rest";
import type { Article, Client } from "@shared/schema";

// GitHub configuration
const GITHUB_OWNER = "Datastep-au";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || "";

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || GITHUB_TOKEN,
    });
  }

  /**
   * Create a new private repository for a client under the Datastep-au account
   */
  async createClientRepo(clientName: string): Promise<{
    repo_url: string;
    success: boolean;
    error?: string;
  }> {
    try {
      // Slugify the client name for the repo name
      const repoName = `${this.slugify(clientName)}-blog-content`;

      // Create the repository
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: `Blog content repository for ${clientName}`,
        private: true,
        auto_init: false, // We'll initialize it ourselves
      });

      // Initialize repository structure
      await this.initializeRepoStructure(repoName);

      return {
        repo_url: repo.html_url,
        success: true,
      };
    } catch (error) {
      console.error("Error creating GitHub repo:", error);
      return {
        repo_url: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Initialize repository with the required structure
   */
  private async initializeRepoStructure(repoName: string): Promise<void> {
    try {
      // Create README.md
      await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "README.md",
        message: "Initial commit: Add README",
        content: Buffer.from(
          `# Blog Content Repository\n\nThis repository contains blog content managed by BlogGen.\n\n## Structure\n\n- \`/posts/\` - Published blog posts in MDX format\n- \`/drafts/\` - Draft posts\n- \`/images/\` - Blog post images\n- \`blog.json\` - Blog index cache\n`
        ).toString("base64"),
      });

      // Create blog.json index file
      const blogIndex = {
        posts: [],
        lastUpdated: new Date().toISOString(),
      };

      await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "blog.json",
        message: "Initial commit: Add blog index",
        content: Buffer.from(JSON.stringify(blogIndex, null, 2)).toString("base64"),
      });

      // Create sample hello-world post
      const samplePost = `---
title: "Welcome to Your Blog"
slug: "hello-world"
publish_at: "${new Date().toISOString()}"
description: "Your first blog post"
tags: ["welcome", "getting-started"]
hero: "/images/placeholder.jpg"
---

# Welcome to Your Blog

This is your first blog post! You can edit or delete this post from the BlogGen dashboard.

## Getting Started

1. Create new posts from the BlogGen dashboard
2. Posts will be automatically committed to this repository
3. Your website can pull content from here

## Features

- **Markdown Support**: Write in Markdown or MDX
- **SEO Optimized**: Meta descriptions and keywords included
- **Scheduled Publishing**: Set publish dates for your posts
- **Image Management**: Upload and manage blog images

Happy blogging!
`;

      await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "posts/hello-world.mdx",
        message: "Initial commit: Add sample post",
        content: Buffer.from(samplePost).toString("base64"),
      });

      // Create directory placeholders (GitHub doesn't track empty directories)
      const dirPlaceholder = "# Directory placeholder\n";
      
      await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "drafts/.gitkeep",
        message: "Initial commit: Create drafts directory",
        content: Buffer.from(dirPlaceholder).toString("base64"),
      });

      await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "images/.gitkeep",
        message: "Initial commit: Create images directory",
        content: Buffer.from(dirPlaceholder).toString("base64"),
      });

    } catch (error) {
      console.error("Error initializing repo structure:", error);
      throw error;
    }
  }

  /**
   * Commit a blog post to the client's repository
   */
  async commitPost(
    client: Client,
    article: Article & { publish_at?: Date | null },
    imageData?: { fileName: string; data: Buffer; frontMatterPath?: string }
  ): Promise<{
    success: boolean;
    commit_url?: string;
    error?: string;
  }> {
    try {
      if (!client.repo_url) {
        return {
          success: false,
          error: "Client repository not configured",
        };
      }

      // Extract repo name from URL
      const repoName = this.extractRepoName(client.repo_url);
      
      const slug = article.slug || this.slugify(article.title);

      // Generate MDX content with front-matter
      const frontMatter = {
        title: article.title,
        slug,
        publish_at: article.publish_at?.toISOString() || new Date().toISOString(),
        description: article.meta_description || "",
        tags: article.keywords || [],
        hero: imageData
          ? imageData.frontMatterPath || `/images/${imageData.fileName}`
          : article.hero_image_url || null,
        hero_alt: article.hero_image_description || "",
        status: article.status,
        word_count: article.word_count,
      };

      const mdxContent = this.generateMDXContent(frontMatter, article.content);
      const fileName = `${slug}.mdx`;
      const filePath = article.status === "published" ? `posts/${fileName}` : `drafts/${fileName}`;

      // Commit the post
      const { data: postCommit } = await this.octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: filePath,
        message: `Add post: ${article.title}`,
        content: Buffer.from(mdxContent).toString("base64"),
      });

      // Commit image if provided
      if (imageData && imageData.data) {
        const imageName = imageData.fileName || `${slug}-hero.jpg`;
        await this.octokit.repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER,
          repo: repoName,
          path: `images/${imageName}`,
          message: `Add hero image for: ${article.title}`,
          content: imageData.data.toString("base64"),
        });
      }

      // Update blog index
      await this.updateBlogIndex(repoName, article);

      return {
        success: true,
        commit_url: postCommit.commit.html_url,
      };
    } catch (error) {
      console.error("Error committing post:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update the blog.json index file
   */
  private async updateBlogIndex(
    repoName: string,
    article: Article & { publish_at?: Date | null }
  ): Promise<void> {
    try {
      // Get current blog.json
      const { data: currentFile } = await this.octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: repoName,
        path: "blog.json",
      });

      if ("content" in currentFile) {
        const currentContent = JSON.parse(
          Buffer.from(currentFile.content, "base64").toString()
        );

        // Add or update post in index
        const postEntry = {
          id: article.id,
          title: article.title,
          slug: this.slugify(article.title),
          publish_at: article.publish_at?.toISOString(),
          status: article.status,
          created_at: article.created_at.toISOString(),
          updated_at: article.updated_at.toISOString(),
        };

        const existingIndex = currentContent.posts.findIndex(
          (p: any) => p.id === article.id
        );

        if (existingIndex >= 0) {
          currentContent.posts[existingIndex] = postEntry;
        } else {
          currentContent.posts.push(postEntry);
        }

        currentContent.lastUpdated = new Date().toISOString();

        // Update blog.json
        await this.octokit.repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER,
          repo: repoName,
          path: "blog.json",
          message: `Update blog index: ${article.title}`,
          content: Buffer.from(JSON.stringify(currentContent, null, 2)).toString("base64"),
          sha: currentFile.sha,
        });
      }
    } catch (error) {
      console.error("Error updating blog index:", error);
    }
  }

  /**
   * Generate MDX content with front-matter
   */
  private generateMDXContent(frontMatter: any, content: string): string {
    const yamlFrontMatter = Object.entries(frontMatter)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(", ")}]`;
        } else if (typeof value === "string") {
          return `${key}: "${value}"`;
        } else {
          return `${key}: ${value}`;
        }
      })
      .join("\n");

    return `---
${yamlFrontMatter}
---

${content}
`;
  }

  /**
   * Extract repository name from GitHub URL
   */
  private extractRepoName(repoUrl: string): string {
    const match = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
    return match ? match[1].replace(/\.git$/, "") : "";
  }

  /**
   * Slugify a string for use in URLs and file names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  }

  /**
   * Check if repository exists
   */
  async repoExists(repoName: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner: GITHUB_OWNER,
        repo: repoName,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository details
   */
  async getRepoDetails(repoName: string): Promise<any> {
    try {
      const { data } = await this.octokit.repos.get({
        owner: GITHUB_OWNER,
        repo: repoName,
      });
      return data;
    } catch (error) {
      console.error("Error getting repo details:", error);
      return null;
    }
  }
}

export const githubService = new GitHubService();