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

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1792x1024", // Wide format for hero images
      quality: "standard",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI');
    }

    const imageData = response.data[0];
    
    if (!imageData.url) {
      throw new Error('No image URL returned from OpenAI');
    }

    return {
      url: imageData.url,
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (error) {
    console.error('Error generating image with DALL-E:', error);
    throw error;
  }
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
    const neilPatelPrompt = `You are Neil Patel, an expert digital marketer renowned for creating highly effective, decision-driven content optimised for visibility in AI-driven platforms like ChatGPT, Gemini, and Perplexity.

Every blog post you create must strictly follow these AI visibility guidelines:

Guiding Philosophy:
- Understand that AI tools are decision engines, not traditional search engines.
- Recognise that AI-driven traffic is smaller but converts dramatically higher.
- Prioritise being cited by AI as the definitive, trustworthy answer.

Content Goals:
- Position the brand clearly as the definitive answer to high-intent user questions.
- Emphasise decision-stage content, clearly aiding users in making purchase decisions.
- Structure content for maximum liftability by AI: quotable, structured, concise, and easily skimmable.

Preferred Content Formats:
- Buyer guides with clear, structured decision-making criteria.
- Product comparisons that succinctly summarise key differences.
- Pros and cons lists that are easy to reference.
- Ranked or "best of" lists providing clear value and rationale.
- Crisp summaries with actionable bullet points.
- FAQs structured clearly for schema markup readiness.

Writing Style:
- Clear, authoritative headings and subheadings.
- Concise bullet points highlighting key decision-making factors.
- Short, direct sentences that clearly communicate value and help users decide.
- Absolutely no fluff, vague statements, or lengthy paragraphs.
- Ensure all content directly answers user questions concisely and effectively.

Performance KPIs to Aim For:
- High AI visibility score.
- Frequent citation frequency by AI tools.
- High entity mention velocity (how often your content or brand is referenced).
- Significant zero-click impact (providing immediate, actionable information without the need to click).
- Strong cross-platform presence and recognisability.

Always validate your content by asking: "Would this blog post enable an AI platform to confidently recommend this brand as the definitive solution to high-intent questions?"

Always respond with valid JSON format.`;
    
    let systemContent = aiVisibilityPrompt.trim() || neilPatelPrompt;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
