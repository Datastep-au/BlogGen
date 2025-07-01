/*
  # Schedule Publisher Function

  This Edge Function runs periodically to check for scheduled articles
  that are ready to be published and processes them.
  
  Features:
  - Checks for overdue scheduled articles
  - Updates article status to published
  - Logs publishing actions
*/

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time
    const now = new Date().toISOString();

    // Find articles that are scheduled and past their scheduled time
    const { data: overdueArticles, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_date', now);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled articles: ${fetchError.message}`);
    }

    let publishedCount = 0;
    const results = [];

    // Process each overdue article
    for (const article of overdueArticles || []) {
      try {
        // Update article status to published
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            status: 'published',
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);

        if (updateError) {
          console.error(`Failed to publish article ${article.id}:`, updateError);
          results.push({
            article_id: article.id,
            title: article.title,
            status: 'failed',
            error: updateError.message
          });
          continue;
        }

        // Update or create schedule job record
        const { error: jobError } = await supabase
          .from('schedule_jobs')
          .upsert({
            article_id: article.id,
            scheduled_date: article.scheduled_date,
            status: 'completed'
          });

        if (jobError) {
          console.error(`Failed to update schedule job for article ${article.id}:`, jobError);
        }

        publishedCount++;
        results.push({
          article_id: article.id,
          title: article.title,
          status: 'published',
          scheduled_date: article.scheduled_date
        });

        console.log(`Published article: ${article.title} (${article.id})`);

      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error);
        results.push({
          article_id: article.id,
          title: article.title,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        published_count: publishedCount,
        total_processed: overdueArticles?.length || 0,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Schedule publisher error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process scheduled articles'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});