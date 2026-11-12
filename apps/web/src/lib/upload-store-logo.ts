/**
 * Store Logo Optimizer & Supabase Storage Uploader
 * Optimizes store brand logos to max 400x400px preserving transparency (PNG/WebP)
 * for razor-sharp rendering on retina screens and 80mm ESC/POS thermal receipt printers.
 * SVGs are preserved as vector without rasterization.
 */

export async function optimizeStoreLogo(file: File, maxDim = 400): Promise<Blob> {
  // If SVG, preserve raw vector
  if (file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Maintain aspect ratio within maxDim
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
        reject(new Error('Failed to acquire canvas rendering context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as PNG to preserve transparent background
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas logo compression failed'));
          }
        },
        'image/png',
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read selected logo image file'));
    };

    img.src = objectUrl;
  });
}

/**
 * Optimizes logo and uploads it to the store assets bucket.
 * Returns the public URL of the uploaded store logo.
 */
export async function uploadStoreLogo(
  file: File,
  tenantSlug = 'deegayu'
): Promise<string> {
  const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
  const payloadBlob = isSvg ? file : await optimizeStoreLogo(file, 400);

  const ext = isSvg ? 'svg' : 'png';
  const fileName = `logo-${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', payloadBlob, fileName);
  formData.append('tenantSlug', tenantSlug);

  const response = await fetch('/api/upload/store-logo', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = 'Failed to upload store logo';
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

