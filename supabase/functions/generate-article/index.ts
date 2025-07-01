/*
  # Generate Article Function (Simplified Version)

  This Edge Function generates SEO-optimized blog articles using OpenAI's GPT-4 Turbo.
  It can handle both single topics and bulk topic generation.
  
  Features:
  - Single and bulk article generation
  - SEO optimization (title, meta description, keywords)
  - Structured content with proper headings
  - Improved error handling and validation
  - Robust JSON parsing to handle markdown code blocks
  - User-specific article creation
  - No Notion integration (simplified version)
*/

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ArticleGeneration {
  topic?: string;
  bulk_topics?: string[];
}

interface GeneratedArticle {
  topic: string;
  title: string;
  content: string;
  meta_description: string;
  keywords: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Parse request body
    const { topic, bulk_topics }: ArticleGeneration = await req.json();

    // Validate input
    if (!topic && (!bulk_topics || bulk_topics.length === 0)) {
      throw new Error('Either topic or bulk_topics must be provided');
    }

    // Get environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role key for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create another client with the user's token for auth verification
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user using the user's token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User authentication error:', userError);
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    console.log(`Authenticated user: ${user.email} (${user.id})`);

    // Determine topics to process
    const topicsToProcess = bulk_topics || [topic!];
    const generatedArticles: GeneratedArticle[] = [];
    const errors: string[] = [];

    // Generate articles for each topic
    for (const currentTopic of topicsToProcess) {
      try {
        console.log(`Generating article for topic: ${currentTopic}`);
        const article = await generateArticle(currentTopic, openaiApiKey);
        generatedArticles.push(article);

        // Save to database with user_id using admin client
        const { data: savedArticle, error: dbError } = await supabaseAdmin
          .from('articles')
          .insert({
            user_id: user.id,
            topic: currentTopic,
            title: article.title,
            content: article.content,
            meta_description: article.meta_description,
            keywords: article.keywords,
            status: 'draft'
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          errors.push(`Failed to save article for "${currentTopic}": ${dbError.message}`);
          continue;
        }

        console.log(`Article saved to database: ${savedArticle.id}`);

      } catch (error) {
        console.error(`Error generating article for topic "${currentTopic}":`, error);
        errors.push(`Failed to generate article for "${currentTopic}": ${error.message}`);
        // Continue with other topics
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_count: generatedArticles.length,
        total_requested: topicsToProcess.length,
        articles: generatedArticles,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate article',
        details: error.stack
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateArticle(topic: string, apiKey: string): Promise<GeneratedArticle> {
  const prompt = `You are a professional SEO content writer. Create a comprehensive, SEO-optimized blog article about "${topic}".

Requirements:
- 1000-1500 words
- Professional yet friendly tone
- Include an engaging introduction that hooks the reader
- Use proper H2 and H3 subheadings for structure (use ## for H2 and ### for H3)
- Include actionable insights, tips, and practical advice
- Write a compelling conclusion with a call-to-action
- Focus on providing real value to readers
- Use natural language that flows well
- Include relevant examples where appropriate

IMPORTANT: Respond with ONLY valid JSON, no markdown formatting or code blocks.

Please provide your response in the following JSON format:
{
  "title": "SEO-optimized title (under 60 characters)",
  "meta_description": "Compelling meta description (under 160 characters)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content": "Full article content with proper markdown formatting including ## for H2 headings and ### for H3 headings"
}`;

  console.log('Calling OpenAI API with GPT-4 Turbo...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO content writer who creates engaging, well-structured blog articles. Always respond with valid JSON only, never use markdown code blocks or any other formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content generated from OpenAI');
  }

  console.log('OpenAI response received, parsing JSON...');

  try {
    // Clean the content to handle common OpenAI response formats
    let cleanContent = content.trim();
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Remove any leading/trailing whitespace again
    cleanContent = cleanContent.trim();
    
    console.log('Cleaned content for parsing:', cleanContent.substring(0, 200) + '...');
    
    const article = JSON.parse(cleanContent);
    
    // Validate required fields
    if (!article.title || !article.content || !article.meta_description) {
      throw new Error('Generated article missing required fields');
    }

    // Ensure keywords is an array
    if (!Array.isArray(article.keywords)) {
      article.keywords = [];
    }

    return {
      topic,
      title: article.title,
      content: article.content,
      meta_description: article.meta_description,
      keywords: article.keywords
    };
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Raw content:', content);
    console.error('Cleaned content:', cleanContent);
    throw new Error(`Failed to parse generated article JSON: ${parseError.message}`);
  }
}