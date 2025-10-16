import { apiRequest } from './queryClient';

export async function optimizeImageUrl(imagePath: string): Promise<{
  optimizedPath: string;
  publicUrl: string;
}> {
  const response = await apiRequest('POST', '/api/images/optimize', {
    imagePath,
    width: 1920,
    quality: 80,
    format: 'webp'
  });

  return await response.json();
}

export async function getImagePublicUrl(imagePath: string): Promise<string> {
  const response = await apiRequest('POST', '/api/images/url', {
    imagePath
  });

  const data = await response.json();
  return data.publicUrl;
}

export function getFullImageUrl(imagePath: string): string {
  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Get base URL from environment or current domain
  const baseUrl = window.location.origin;
  
  // Ensure path starts with /
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${path}`;
}
