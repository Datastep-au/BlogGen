import crypto from 'crypto';
import { getStorage } from '../storage';
import type { WebhookEvent } from '@shared/schema';

export interface WebhookPayload {
  event: WebhookEvent;
  site_id: string;
  post_id: string;
  slug: string;
  previous_slug?: string;
  updated_at: string;
  content_hash: string;
}

export async function emitWebhookEvent(payload: WebhookPayload): Promise<void> {
  const storage = await getStorage();
  
  // Get active webhooks for this site
  const webhooks = await storage.getActiveWebhooksBySiteId(payload.site_id);
  
  if (webhooks.length === 0) {
    console.log(`No active webhooks for site ${payload.site_id}`);
    return;
  }

  // Schedule webhook deliveries as jobs
  for (const webhook of webhooks) {
    await storage.createScheduledJob({
      job_type: 'webhook_delivery',
      payload: {
        webhook_id: webhook.id,
        webhook_url: webhook.url, // Changed from target_url to url
        webhook_secret: webhook.secret || '',  // Handle optional secret
        event_payload: payload
      },
      scheduled_for: new Date(),
      max_attempts: 5
    });
  }
}

export async function deliverWebhook(
  webhookId: string,
  targetUrl: string,
  secret: string,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const storage = await getStorage();
    const bodyString = JSON.stringify(payload);
    
    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bloggen-Event': payload.event,
        'X-Bloggen-Signature': `sha256=${signature}`,
        'X-Bloggen-Delivery': crypto.randomUUID(),
        'User-Agent': 'Bloggen-Webhooks/1.0'
      },
      body: bodyString,
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    const responseBody = await response.text().catch(() => '');

    // Log delivery
    await storage.createWebhookDeliveryLog({
      webhook_id: webhookId,
      post_id: payload.post_id,
      event: payload.event,
      status_code: response.status,
      response_body: responseBody.substring(0, 1000), // Limit to 1000 chars
      attempt
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      return { 
        success: false, 
        statusCode: response.status, 
        error: `HTTP ${response.status}: ${responseBody.substring(0, 200)}` 
      };
    }
  } catch (error) {
    const storage = await getStorage();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed delivery
    await storage.createWebhookDeliveryLog({
      webhook_id: webhookId,
      post_id: payload.post_id,
      event: payload.event,
      error: errorMessage,
      attempt
    });

    return { success: false, error: errorMessage };
  }
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}
