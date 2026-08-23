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
// `id` names the R2 object after the entity's own id, so this upload
// overwrites the entity's previous photo instead of leaving it as an
// orphaned object. Required for `entity: 'ingredient' | 'recipe'` — by the
// time this is called (at form-submit time, via DeferredPhotoUpload's
// consumers), the entity's real id is always already known, whether an
// existing row's (edit) or a fresh client-generated one that doesn't exist
// in Postgres yet (create — see createIngredient/createRecipe, which
// generate ids the same way). Omitted (and ignored if passed) for
// `avatar`, which the Edge Function always keys by the caller's own user
// id server-side.
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

// Deletes an ingredient/recipe's R2 photo via the delete-photo Edge
// Function — never called directly for `avatar` (no account-deletion
// feature exists to trigger it). Must be called before the row itself is
// removed from Dexie/the outbox — see deleteIngredient/deleteRecipe.
export async function deletePhoto(entity: 'ingredient' | 'recipe', id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-photo', {
    body: { entity, id },
  });
  if (error) throw error;
}
