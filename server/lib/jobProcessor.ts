import { getStorage } from '../storage';
import { deliverWebhook, emitWebhookEvent } from './webhooks';
import type { WebhookPayload } from './webhooks';

let processorInterval: NodeJS.Timeout | null = null;

export async function startJobProcessor(intervalMs: number = 60000) {
  if (processorInterval) {
    console.log('⚙️  Job processor already running');
    return;
  }

  console.log(`🔄 Starting job processor (checking every ${Math.round(intervalMs/1000)}s)`);

  // Process immediately on start
  try {
    await processJobs();
    console.log('✅ Job processor initial run completed');
  } catch (error) {
    console.error('❌ Job processor initial run failed:', error);
  }

  // Then process periodically
  processorInterval = setInterval(async () => {
    await processJobs();
  }, intervalMs);
  
  console.log('✅ Job processor started successfully');
}

export function stopJobProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    console.log('Job processor stopped');
  }
}

async function processJobs() {
  try {
    await processScheduledPosts();
    await processWebhookDeliveries();
  } catch (error) {
    console.error('Error processing jobs:', error);
  }
}

async function processScheduledPosts() {
  const storage = await getStorage();
  const now = new Date();

  // Get pending scheduled post jobs
  const jobs = await storage.getPendingScheduledJobs(now);
  const postJobs = jobs.filter(job => job.job_type === 'publish_scheduled_post');

  for (const job of postJobs) {
    try {
      const { post_id } = job.payload as { post_id: string };
      const post = await storage.getPost(post_id);

      if (!post) {
        console.error(`Post ${post_id} not found, marking job as completed`);
        await storage.updateScheduledJob(job.id, {
          completed_at: new Date(),
          last_error: 'Post not found'
        });
        continue;
      }

      // Check if post should be published
      if (post.status === 'scheduled' && post.published_at && new Date(post.published_at) <= now) {
        // Update post status to published
        await storage.updatePost(post_id, {
          status: 'published'
        });

        // Emit webhook
        await emitWebhookEvent({
          event: 'post_published',
          site_id: post.site_id,
          post_id: post.id,
          slug: post.slug,
          updated_at: new Date().toISOString(),
          content_hash: post.content_hash
        });

        // Mark job as completed
        await storage.updateScheduledJob(job.id, {
          completed_at: new Date()
        });

        console.log(`✅ Published scheduled post: ${post.title}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing scheduled post job ${job.id}:`, errorMessage);
      
      await storage.updateScheduledJob(job.id, {
        attempts: job.attempts + 1,
        last_error: errorMessage
      });

      // If max attempts reached, mark as completed with error
      if (job.attempts + 1 >= job.max_attempts) {
        await storage.updateScheduledJob(job.id, {
          completed_at: new Date()
        });
      }
    }
  }
}

async function processWebhookDeliveries() {
  const storage = await getStorage();
  const now = new Date();

  // Get pending webhook delivery jobs
  const jobs = await storage.getPendingScheduledJobs(now);
  const webhookJobs = jobs.filter(job => job.job_type === 'webhook_delivery');

  for (const job of webhookJobs) {
    try {
      const { webhook_id, webhook_url, webhook_secret, event_payload } = job.payload as {
        webhook_id: string;
        webhook_url: string;
        webhook_secret: string;
        event_payload: WebhookPayload;
      };

      const currentAttempt = job.attempts + 1;
      
      const result = await deliverWebhook(
        webhook_id,
        webhook_url,
        webhook_secret,
        event_payload,
        currentAttempt
      );

      if (result.success) {
        // Mark job as completed
        await storage.updateScheduledJob(job.id, {
          completed_at: new Date()
        });
        console.log(`✅ Webhook delivered to ${webhook_url}`);
      } else {
        // Increment attempts and schedule retry with exponential backoff
        const attempts = job.attempts + 1;
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 3600000); // Max 1 hour
        const nextAttempt = new Date(Date.now() + backoffMs);

        await storage.updateScheduledJob(job.id, {
          attempts,
          last_error: result.error || 'Delivery failed',
          scheduled_for: attempts < job.max_attempts ? nextAttempt : job.scheduled_for
        });

        // If max attempts reached, mark as completed with error
        if (attempts >= job.max_attempts) {
          await storage.updateScheduledJob(job.id, {
            completed_at: new Date()
          });
          console.error(`❌ Webhook delivery failed after ${attempts} attempts: ${webhook_url}`);
        } else {
          console.log(`⚠️  Webhook delivery failed (attempt ${attempts}/${job.max_attempts}), retrying in ${Math.round(backoffMs / 1000)}s`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing webhook delivery job ${job.id}:`, errorMessage);
      
      const attempts = job.attempts + 1;
      await storage.updateScheduledJob(job.id, {
        attempts,
        last_error: errorMessage
      });

      if (attempts >= job.max_attempts) {
        await storage.updateScheduledJob(job.id, {
          completed_at: new Date()
        });
      }
    }
  }
}
