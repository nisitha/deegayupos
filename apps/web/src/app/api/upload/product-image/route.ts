import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://gxnuhdzlayagkbnhminb.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawTenantSlug = formData.get('tenantSlug') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const tenantSlug = (rawTenantSlug || 'deegayu')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') || 'deegayu';

    // Sanitize file name
    const rawName = file.name || 'product.webp';
    const baseName = rawName
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'product';

    const timestamp = Date.now();
    const fileName = `${timestamp}-${baseName}.webp`;
    const storagePath = `${tenantSlug}/${fileName}`;

    // Read bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. If Supabase Service Role Key is configured, upload to Supabase Storage
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });

        const bucketName = 'product-images';

        // Check or create public bucket if needed
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (!listError) {
          const bucketExists = buckets?.some((b) => b.name === bucketName);
          if (!bucketExists) {
            await supabase.storage.createBucket(bucketName, {
              public: true,
              fileSizeLimit: 5 * 1024 * 1024,
            });
          }
        }

        // Upload to bucket
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: file.type || 'image/webp',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) {
            return NextResponse.json({
              url: publicUrlData.publicUrl,
              storage: 'supabase',
              path: storagePath,
            });
          }
        } else {
          console.warn('[Upload] Supabase storage upload warning:', uploadError.message);
        }
      } catch (supabaseErr: unknown) {
        const msg = supabaseErr instanceof Error ? supabaseErr.message : String(supabaseErr);
        console.warn('[Upload] Supabase client error:', msg);
      }
    }

    // 2. High-reliability fallback: Store in Next.js public/uploads directory
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'products', tenantSlug);
    await fs.promises.mkdir(publicDir, { recursive: true });

    const localFilePath = path.join(publicDir, fileName);
    await fs.promises.writeFile(localFilePath, buffer);

    const localUrl = `/uploads/products/${tenantSlug}/${fileName}`;

    return NextResponse.json({
      url: localUrl,
      storage: 'local',
      path: storagePath,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to process image upload';
    console.error('[Upload Product Image Error]', error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
