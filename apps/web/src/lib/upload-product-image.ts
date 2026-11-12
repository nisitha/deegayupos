/**
 * Client-Side Image Compressor & Supabase Storage Uploader
 * Resizes images client-side to max 600x600px with 0.82 quality WebP/JPEG compression (~40KB-90KB)
 * for optimal POS performance and IndexedDB offline caching.
 */

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

  // 2. Prepare multipart upload
  const sanitizedBase = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const fileName = `${sanitizedBase || 'product'}.webp`;

  const formData = new FormData();
  formData.append('file', compressedBlob, fileName);
  formData.append('tenantSlug', tenantSlug);

  // 3. Post to Supabase storage upload endpoint
  const response = await fetch('/api/upload/product-image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = 'Failed to upload product image';
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as { url: string };
  if (!data?.url) {
    throw new Error('Upload endpoint did not return an image URL');
  }

  return data.url;
}

