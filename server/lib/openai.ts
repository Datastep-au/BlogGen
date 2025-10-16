import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface BlogArticle {
  title: string;
  content: string;
  metaDescription: string;
  keywords: string[];
  wordCount: number;
}

export async function generateBlogArticle(topic: string): Promise<BlogArticle> {
  try {
    // Get the AI visibility prompt from environment variables
    const aiVisibilityPrompt = process.env.AI_VISIBILITY_PROMPT || '';
    
    const prompt = `Generate a comprehensive, SEO-optimized blog article on the topic: "${topic}".

Please provide the response in JSON format with the following structure:
{
  "title": "SEO-optimized title (max 60 characters)",
  "metaDescription": "Compelling meta description for SEO (max 160 characters)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content": "Full article content with proper H2 and H3 headings, well-structured paragraphs, and natural keyword integration. Include an introduction, multiple sections with subheadings, and a conclusion. Aim for 1000-1500 words.",
  "wordCount": estimated_word_count
}

Requirements:
- Title should be catchy and SEO-friendly
- Meta description should be compelling and under 160 characters
- Include 5-7 relevant keywords
- Content should have proper structure with H2/H3 headings
- Write in a professional yet engaging tone
- Include actionable insights and valuable information
- Naturally integrate keywords throughout the content
- Ensure the content is original and comprehensive`;

    // Build system content with AI visibility guidelines
    let systemContent = "You are a professional SEO content writer and blog expert. Generate high-quality, search-engine optimized blog articles that engage readers and rank well in search results. Always respond with valid JSON format.";
    
    if (aiVisibilityPrompt.trim()) {
      systemContent += `\n\nIMPORTANT: Follow these additional guidelines when writing the article:\n${aiVisibilityPrompt}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemContent
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and format the response
    const article: BlogArticle = {
      title: result.title || `The Ultimate Guide to ${topic}`,
      content: result.content || '',
      metaDescription: result.metaDescription || '',
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
      wordCount: result.wordCount || result.content?.split(/\s+/).length || 0
    };

    // Ensure meta description is within limits
    if (article.metaDescription.length > 160) {
      article.metaDescription = article.metaDescription.substring(0, 157) + '...';
    }

    // Ensure title is within limits
    if (article.title.length > 60) {
      article.title = article.title.substring(0, 57) + '...';
    }

    return article;
  } catch (error) {
    console.error('Error generating blog article:', error);
    throw new Error(`Failed to generate article: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateMultipleBlogArticles(topics: string[]): Promise<{
  articles: BlogArticle[];
  errors: string[];
}> {
  const articles: BlogArticle[] = [];
  const errors: string[] = [];

  for (const topic of topics) {
    try {
      const article = await generateBlogArticle(topic);
      articles.push(article);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to generate article for "${topic}": ${errorMessage}`);
    }
  }

  return { articles, errors };
}
