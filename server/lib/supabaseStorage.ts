import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.VITE_DATABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. Storage features will be limited.');
}

export const supabaseStorage = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'bloggen-assets';

export async function initializeStorageBucket() {
  try {
    const { data: buckets } = await supabaseStorage.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      const { data, error } = await supabaseStorage.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });

      if (error) {
        console.error('Failed to create storage bucket:', error);
      } else {
        console.log('✅ Storage bucket created:', BUCKET_NAME);
      }
    } else {
      console.log('✅ Storage bucket already exists:', BUCKET_NAME);
    }
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
  }
}

export interface ImageVariant {
  name: string;
  width: number;
  height?: number;
  format: 'webp' | 'jpeg' | 'png';
}

const IMAGE_VARIANTS: Record<string, ImageVariant> = {
  hero: { name: 'hero', width: 1600, format: 'webp' },
  social: { name: 'social', width: 1200, height: 630, format: 'jpeg' },
  thumbnail: { name: 'thumb', width: 400, format: 'webp' },
  medium: { name: 'medium', width: 800, format: 'webp' },
};

export interface UploadImageOptions {
  siteId: string;
  postId?: string;
  role: 'cover' | 'inline' | 'og' | 'hero';
  generateVariants?: boolean;
}

export interface UploadedImage {
  url: string;
  path: string;
  width: number;
  height: number;
  size: number;
  variant?: string;
}

export async function uploadImage(
  imageBuffer: Buffer,
  filename: string,
  options: UploadImageOptions
): Promise<UploadedImage[]> {
  const { siteId, postId, role, generateVariants = true } = options;
  
  const uploadedImages: UploadedImage[] = [];
  const timestamp = Date.now();
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const ext = filename.split('.').pop() || 'jpg';

  const storagePath = postId 
    ? `sites/${siteId}/${postId}`
    : `sites/${siteId}/general`;

  if (generateVariants) {
    for (const [key, variant] of Object.entries(IMAGE_VARIANTS)) {
      if (role === 'og' && key !== 'social') continue;
      if (role === 'hero' && key !== 'hero') continue;

      try {
        let image = sharp(imageBuffer);
        
        if (variant.height) {
          image = image.resize(variant.width, variant.height, {
            fit: 'cover',
            position: 'center'
          });
        } else {
          image = image.resize(variant.width, null, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        const processedBuffer = await image
          .toFormat(variant.format, {
            quality: variant.format === 'jpeg' ? 85 : 80
          })
          .toBuffer();

        const metadata = await sharp(processedBuffer).metadata();
        const variantFilename = `${baseName}-${variant.name}-${timestamp}.${variant.format}`;
        const path = `${storagePath}/${variantFilename}`;

        const { data, error } = await supabaseStorage.storage
          .from(BUCKET_NAME)
          .upload(path, processedBuffer, {
            contentType: `image/${variant.format}`,
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error(`Failed to upload variant ${variant.name}:`, error);
          continue;
        }

        const { data: { publicUrl } } = supabaseStorage.storage
          .from(BUCKET_NAME)
          .getPublicUrl(path);

        uploadedImages.push({
          url: publicUrl,
          path: data.path,
          width: metadata.width || variant.width,
          height: metadata.height || variant.height || 0,
          size: processedBuffer.length,
          variant: variant.name
        });
      } catch (error) {
        console.error(`Error processing variant ${variant.name}:`, error);
      }
    }
  } else {
    const path = `${storagePath}/${baseName}-${timestamp}.${ext}`;
    const metadata = await sharp(imageBuffer).metadata();

    const { data, error } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .upload(path, imageBuffer, {
        contentType: `image/${ext}`,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: { publicUrl } } = supabaseStorage.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    uploadedImages.push({
      url: publicUrl,
      path: data.path,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: imageBuffer.length
    });
  }

  return uploadedImages;
}

export async function deleteImage(path: string): Promise<boolean> {
  try {
    const { error } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Failed to delete image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

export async function getImagePublicUrl(path: string): Promise<string> {
  const { data } = supabaseStorage.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}
