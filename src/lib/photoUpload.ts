import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

export type PhotoEntity = 'ingredient' | 'recipe' | 'avatar';

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

// Compresses/converts to WebP client-side, requests a presigned R2 upload
// URL from the get-upload-url Edge Function (docs/rpcs.md), then PUTs the
// compressed file directly to R2 — the server never touches file bytes.
//
// `id` (an existing ingredient/recipe id) makes the Edge Function name the
// R2 object after that id, so this upload overwrites the entity's previous
// photo instead of leaving it as an orphaned object — omit it when
// uploading for a not-yet-created row (there's nothing to overwrite yet;
// the function falls back to a fresh random id). Ignored for `avatar`,
// which always names the object after the caller's own user id.
export async function uploadPhoto(file: File, entity: PhotoEntity, id?: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1024,
    fileType: 'image/webp',
    useWebWorker: true,
  });

  const { data, error } = await supabase.functions.invoke<UploadUrlResponse>('get-upload-url', {
    body: { entity, id },
  });
  if (error) throw error;
  if (!data) throw new Error('Failed to get an upload URL. Try again.');

  const putResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: compressed,
    headers: { 'Content-Type': 'image/webp' },
  });
  if (!putResponse.ok) {
    throw new Error('Failed to upload photo. Try again.');
  }

  return data.publicUrl;
}
