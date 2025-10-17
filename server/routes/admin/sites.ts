import { Router } from 'express';
import { getStorage } from '../../storage';
import { generateApiKey, hashApiKey, generateSiteJWT } from '../../lib/apiAuth';
import { insertSiteSchema } from '@shared/schema';

const router = Router();

// Create a new site
router.post('/', async (req, res) => {
  try {
    const storage = await getStorage();
    const data = insertSiteSchema.parse(req.body);

    // Generate API key and hash it
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);

    const site = await storage.createSite({
      ...data,
      api_key_hash: apiKeyHash,
    });

    // Generate JWT token for the site
    const token = generateSiteJWT(site.id, site.domain || undefined);

    res.json({
      site,
      api_key: apiKey, // Only shown once
      token,
      message: 'Site created successfully. Save the API key - it will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// List sites for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const storage = await getStorage();
    const clientId = parseInt(req.params.clientId);
    
    const sites = await storage.getSitesByClientId(clientId);
    
    // Don't send API key hashes to client
    const sanitizedSites = sites.map(site => ({
      id: site.id,
      client_id: site.client_id,
      name: site.name,
      domain: site.domain,
      is_active: site.is_active,
      created_at: site.created_at,
      updated_at: site.updated_at
    }));

    res.json(sanitizedSites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Get single site
router.get('/:siteId', async (req, res) => {
  try {
    const storage = await getStorage();
    const site = await storage.getSite(req.params.siteId);

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Don't send API key hash
    const { api_key_hash, ...siteData } = site;

    res.json(siteData);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// Rotate API key
router.post('/:siteId/rotate-key', async (req, res) => {
  try {
    const storage = await getStorage();
    const site = await storage.getSite(req.params.siteId);

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Generate new API key and hash
    const newApiKey = generateApiKey();
    const newApiKeyHash = await hashApiKey(newApiKey);

    const updatedSite = await storage.updateSite(req.params.siteId, {
      api_key_hash: newApiKeyHash
    });

    // Generate new JWT token
    const token = generateSiteJWT(updatedSite.id, updatedSite.domain || undefined);

    res.json({
      api_key: newApiKey,
      token,
      message: 'API key rotated successfully. Save the new key - it will not be shown again.'
    });
  } catch (error) {
    console.error('Error rotating API key:', error);
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

// Update site
router.put('/:siteId', async (req, res) => {
  try {
    const storage = await getStorage();
    const { name, domain, is_active } = req.body;

    const site = await storage.updateSite(req.params.siteId, {
      name,
      domain,
      is_active
    });

    const { api_key_hash, ...siteData } = site;
    res.json(siteData);
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Delete site
router.delete('/:siteId', async (req, res) => {
  try {
    const storage = await getStorage();
    await storage.deleteSite(req.params.siteId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

export default router;
