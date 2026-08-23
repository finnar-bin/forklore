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
export async function uploadPhoto(file: File, entity: PhotoEntity): Promise<string> {
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
    body: { entity },
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
