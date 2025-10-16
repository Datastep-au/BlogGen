import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

export async function optimizeImage(
  inputPath: string,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  const {
    width = 1920,
    height,
    quality = 80,
    format = 'webp'
  } = options;

  const inputDir = path.dirname(inputPath);
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(inputDir, `${inputName}_optimized.${format}`);

  try {
    let sharpInstance = sharp(inputPath);

    // Resize if dimensions provided
    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert and optimize based on format
    switch (format) {
      case 'webp':
        await sharpInstance
          .webp({ quality, effort: 6 })
          .toFile(outputPath);
        break;
      case 'jpeg':
        await sharpInstance
          .jpeg({ quality, mozjpeg: true })
          .toFile(outputPath);
        break;
      case 'png':
        await sharpInstance
          .png({ quality, compressionLevel: 9 })
          .toFile(outputPath);
        break;
    }

    // Get file stats to compare sizes
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);
    
    console.log(`📸 Image optimized: ${inputPath}`);
    console.log(`   Original: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Optimized: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Savings: ${(((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1)}%`);

    return outputPath;
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw error;
  }
}

export async function getImagePublicUrl(imagePath: string): Promise<string> {
  // Convert file system path to public URL
  // Example: attached_assets/generated_images/image.webp -> /attached_assets/generated_images/image.webp
  const publicPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // In production, this should use your domain
  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
  
  return `${baseUrl}${publicPath}`;
}
