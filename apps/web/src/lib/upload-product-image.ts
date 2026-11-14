/**
 * Client-Side Image Compressor & Supabase Storage Uploader
 * Resizes images client-side to max 600x600px with 0.82 quality WebP/JPEG compression (~40KB-90KB)
 * for optimal POS performance and IndexedDB offline caching.
 */

import { supabase } from './supabase';

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Resizes an image file to within maxDimension x maxDimension preserving aspect ratio
 * and encodes it as image/webp (fallback to image/jpeg if webp unsupported).
 */
export async function compressProductImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const maxDim = options.maxDimension ?? 600;
  const quality = options.quality ?? 0.82;

  // If already tiny WebP under 40KB, return as-is
  if (file.type === 'image/webp' && file.size < 40 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Preserve aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        reject(new Error('Failed to obtain canvas 2D rendering context'));
        return;
      }

      // Smooth downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try image/webp first
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback to image/jpeg if webp is unsupported
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  resolve(fallbackBlob);
                } else {
                  reject(new Error('Canvas image compression failed'));
                }
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read selected image file'));
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses an image client-side and uploads it via the Next.js API to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadProductImage(
  file: File,
  tenantSlug = 'deegayu',
  options?: CompressOptions
): Promise<string> {
  // 1. Client-side compression (< 100ms)
  const compressedBlob = await compressProductImage(file, options);

  // 2. Prepare storage file path
  const sanitizedBase = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const fileName = `${sanitizedBase || 'product'}.webp`;
  const storagePath = `${tenantSlug}/${Date.now()}-${fileName}`;

  try {
    // 3. Upload directly to Supabase Storage bucket 'product-images'
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, compressedBlob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath);

      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn('[Storage] Supabase upload failed, falling back to local data URL:', storageErr);
  }

  // Fallback to client-side data URL for offline resilience
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(compressedBlob);
  });
}

