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
      return NextResponse.json({ error: 'No logo file provided' }, { status: 400 });
    }

    const tenantSlug = (rawTenantSlug || 'deegayu')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') || 'deegayu';

    // Determine extension
    let ext = 'png';
    const mime = file.type?.toLowerCase() || '';
    if (mime.includes('svg')) {
      ext = 'svg';
    } else if (mime.includes('webp')) {
      ext = 'webp';
    } else if (mime.includes('jpeg') || mime.includes('jpg')) {
      ext = 'jpg';
    } else if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      ext = parts[parts.length - 1]?.toLowerCase() || 'png';
    }

    const timestamp = Date.now();
    const fileName = `logo-${timestamp}.${ext}`;
    const storagePath = `${tenantSlug}/${fileName}`;

    // Read bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload directly to Supabase Storage bucket 'store-assets'
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });

        const bucketName = 'store-assets';

        // Auto-create public bucket if missing
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (!listError) {
          const exists = buckets?.some((b) => b.name === bucketName);
          if (!exists) {
            await supabase.storage.createBucket(bucketName, {
              public: true,
              fileSizeLimit: 5 * 1024 * 1024,
            });
          }
        }

        // Upload file
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: file.type || (ext === 'svg' ? 'image/svg+xml' : `image/${ext}`),
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
          console.warn('[Logo Upload] Supabase storage upload warning:', uploadError.message);
        }
      } catch (supabaseErr: unknown) {
        const msg = supabaseErr instanceof Error ? supabaseErr.message : String(supabaseErr);
        console.warn('[Logo Upload] Supabase client error:', msg);
      }
    }

    // 2. High-reliability fallback: Store in Next.js public/uploads directory
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'logos', tenantSlug);
    await fs.promises.mkdir(publicDir, { recursive: true });

    const localFilePath = path.join(publicDir, fileName);
    await fs.promises.writeFile(localFilePath, buffer);

    const localUrl = `/uploads/logos/${tenantSlug}/${fileName}`;

    return NextResponse.json({
      url: localUrl,
      storage: 'local',
      path: storagePath,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to process logo upload';
    console.error('[Store Logo Upload Error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

