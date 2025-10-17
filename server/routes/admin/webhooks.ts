import { Router } from 'express';
import { getStorage } from '../../storage';
import { insertWebhookSchema } from '@shared/schema';
import crypto from 'crypto';

const router = Router();

// Create webhook
router.post('/', async (req, res) => {
  try {
    const storage = await getStorage();
    const data = insertWebhookSchema.parse(req.body);

    // Generate a secret if not provided
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await storage.createWebhook({
      ...data,
      secret
    });

    res.json({
      webhook,
      secret, // Only shown once
      message: 'Webhook created successfully. Save the secret - it will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// List webhooks for a site
router.get('/site/:siteId', async (req, res) => {
  try {
    const storage = await getStorage();
    const webhooks = await storage.getWebhooksBySiteId(req.params.siteId);

    // Don't send secrets to client
    const sanitizedWebhooks = webhooks.map(wh => ({
      id: wh.id,
      site_id: wh.site_id,
      target_url: wh.target_url,
      is_active: wh.is_active,
      created_at: wh.created_at
    }));

    res.json(sanitizedWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get webhook delivery logs
router.get('/:webhookId/logs', async (req, res) => {
  try {
    const storage = await getStorage();
    const limit = parseInt(req.query.limit as string) || 50;
    
    const logs = await storage.getWebhookDeliveryLogs(req.params.webhookId, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

// Update webhook
router.put('/:webhookId', async (req, res) => {
  try {
    const storage = await getStorage();
    const { target_url, is_active } = req.body;

    const webhook = await storage.updateWebhook(req.params.webhookId, {
      target_url,
      is_active
    });

    const { secret, ...webhookData } = webhook;
    res.json(webhookData);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Rotate webhook secret
router.post('/:webhookId/rotate-secret', async (req, res) => {
  try {
    const storage = await getStorage();
    const newSecret = crypto.randomBytes(32).toString('hex');

    await storage.updateWebhook(req.params.webhookId, {
      secret: newSecret
    });

    res.json({
      secret: newSecret,
      message: 'Webhook secret rotated successfully. Save the new secret - it will not be shown again.'
    });
  } catch (error) {
    console.error('Error rotating webhook secret:', error);
    res.status(500).json({ error: 'Failed to rotate webhook secret' });
  }
});

// Delete webhook
router.delete('/:webhookId', async (req, res) => {
  try {
    const storage = await getStorage();
    await storage.deleteWebhook(req.params.webhookId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

export default router;
