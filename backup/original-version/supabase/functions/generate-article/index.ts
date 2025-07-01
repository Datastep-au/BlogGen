/*
  # Generate Article Function

  This Edge Function generates SEO-optimized blog articles using OpenAI's GPT-4 Turbo.
  It can handle both single topics and bulk topic generation.
  
  Features:
  - Single and bulk article generation
  - SEO optimization (title, meta description, keywords)
  - Notion integration for saving articles as pages AND tracking in database
  - Structured content with proper headings
  - Improved error handling and validation
  - Robust JSON parsing to handle markdown code blocks
  - User-specific article creation
*/

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ArticleGeneration {
  topic?: string;
  bulk_topics?: string[];
  notion_parent_page_id?: string;
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
    const { topic, bulk_topics, notion_parent_page_id }: ArticleGeneration = await req.json();

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

        // Save to Notion if connection provided
        if (notion_parent_page_id && savedArticle) {
          try {
            console.log(`Saving to Notion parent page: ${notion_parent_page_id}`);
            const notionResults = await saveToNotion(savedArticle, notion_parent_page_id, supabaseAdmin, user.id);
            console.log(`Saved to Notion - Page: ${notionResults.pageId}, Database: ${notionResults.databaseEntryId}`);
          } catch (notionError) {
            console.error('Notion error:', notionError);
            errors.push(`Failed to save "${currentTopic}" to Notion: ${notionError.message}`);
            // Continue even if Notion fails
          }
        }

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

async function saveToNotion(article: any, parentPageId: string, supabase: any, userId: string) {
  console.log(`Looking up Notion connection for parent page: ${parentPageId} and user: ${userId}`);
  
  // Get Notion connection details for the specific user
  const { data: connection, error } = await supabase
    .from('notion_connections')
    .select('access_token, workspace_name, tracking_database_id')
    .eq('parent_page_id', parentPageId)
    .eq('user_id', userId)
    .single();

  if (error || !connection) {
    console.error('Notion connection lookup error:', error);
    throw new Error(`Notion connection not found for parent page ${parentPageId} and user ${userId}`);
  }

  console.log(`Found connection for workspace: ${connection.workspace_name}`);

  // Save article as a page
  const pageId = await saveToNotionPage(article, parentPageId, connection.access_token);
  
  // Save tracking entry to database (if database is configured)
  let databaseEntryId = null;
  if (connection.tracking_database_id) {
    try {
      databaseEntryId = await saveToNotionDatabase(article, connection.tracking_database_id, connection.access_token);
    } catch (dbError) {
      console.error('Failed to save to tracking database:', dbError);
      // Don't fail the entire operation if database tracking fails
    }
  }

  // Update article with Notion page ID
  await supabase
    .from('articles')
    .update({ notion_page_id: pageId })
    .eq('id', article.id)
    .eq('user_id', userId);

  return { pageId, databaseEntryId };
}

async function saveToNotionPage(article: any, parentPageId: string, accessToken: string) {
  // Convert markdown content to Notion blocks
  const contentBlocks = convertMarkdownToNotionBlocks(article.content);

  // Create the article page as a child of the parent page
  const notionPayload = {
    parent: { 
      type: "page_id",
      page_id: parentPageId 
    },
    properties: {
      title: {
        title: [
          {
            text: {
              content: article.title
            }
          }
        ]
      }
    },
    children: [
      // Add meta information at the top
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `📝 Meta Description: ${article.meta_description}`
              }
            }
          ],
          icon: {
            emoji: "📝"
          },
          color: "blue_background"
        }
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `🏷️ Keywords: ${article.keywords.join(', ')}`
              }
            }
          ],
          icon: {
            emoji: "🏷️"
          },
          color: "green_background"
        }
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `📂 Topic: ${article.topic}`
              }
            }
          ],
          icon: {
            emoji: "📂"
          },
          color: "yellow_background"
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      },
      // Add the article content
      ...contentBlocks
    ]
  };

  console.log('Creating Notion page...');

  const notionResponse = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(notionPayload),
  });

  if (!notionResponse.ok) {
    const error = await notionResponse.json();
    console.error('Notion API error:', error);
    throw new Error(`Notion API error: ${error.message || 'Unknown error'}`);
  }

  const notionPage = await notionResponse.json();
  console.log(`Notion page created: ${notionPage.id}`);

  return notionPage.id;
}

async function saveToNotionDatabase(article: any, databaseId: string, accessToken: string) {
  // Create database entry for tracking
  const databasePayload = {
    parent: {
      type: "database_id",
      database_id: databaseId
    },
    properties: {
      "Article Name": {
        title: [
          {
            text: {
              content: article.title
            }
          }
        ]
      },
      "Topic": {
        rich_text: [
          {
            text: {
              content: article.topic
            }
          }
        ]
      },
      "Status": {
        select: {
          name: "Draft"
        }
      },
      "Creation Date": {
        date: {
          start: new Date().toISOString().split('T')[0]
        }
      }
      // Publish Date is left empty for user to fill
    }
  };

  console.log('Creating Notion database entry...');

  const databaseResponse = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(databasePayload),
  });

  if (!databaseResponse.ok) {
    const error = await databaseResponse.json();
    console.error('Notion database API error:', error);
    throw new Error(`Notion database API error: ${error.message || 'Unknown error'}`);
  }

  const databaseEntry = await databaseResponse.json();
  console.log(`Notion database entry created: ${databaseEntry.id}`);

  return databaseEntry.id;
}

function convertMarkdownToNotionBlocks(markdown: string) {
  const lines = markdown.split('\n');
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      // Skip empty lines
      continue;
    }

    if (line.startsWith('### ')) {
      // H3 heading
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(4)
              }
            }
          ]
        }
      });
    } else if (line.startsWith('## ')) {
      // H2 heading
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(3)
              }
            }
          ]
        }
      });
    } else if (line.startsWith('# ')) {
      // H1 heading
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: line.substring(2)
              }
            }
          ]
        }
      });
    } else {
      // Regular paragraph - split into chunks if too long
      const chunks = splitTextIntoChunks(line, 2000);
      for (const chunk of chunks) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: chunk
                }
              }
            ]
          }
        });
      }
    }
  }

  return blocks;
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = '';
  const sentences = text.split('. ');

  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
    
    if (potentialChunk.length <= maxLength) {
      currentChunk = potentialChunk;
    } else {
      // If current chunk has content, save it and start new chunk
      if (currentChunk) {
        chunks.push(currentChunk + '.');
        currentChunk = sentence;
      } else {
        // If single sentence is too long, split by words
        const words = sentence.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          const potentialWordChunk = wordChunk + (wordChunk ? ' ' : '') + word;
          
          if (potentialWordChunk.length <= maxLength) {
            wordChunk = potentialWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
              wordChunk = word;
            } else {
              // Single word is too long, truncate it
              chunks.push(word.substring(0, maxLength));
              wordChunk = '';
            }
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}