import imageCompression from "browser-image-compression";
import { supabase } from "./supabase";

export type PhotoEntity = "ingredient" | "recipe" | "avatar";

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
// orphaned object. Required for `entity: 'ingredient' | 'recipe'` (enforced
// by the overloads below, not just the runtime check) — by the time this
// is called (at form-submit time, via DeferredPhotoUpload's consumers),
// the entity's real id is always already known, whether an existing row's
// (edit) or a fresh client-generated one that doesn't exist in Postgres
// yet (create — see createIngredient/createRecipe, which generate ids the
// same way). Omitted for `avatar`, which the Edge Function always keys by
// the caller's own user id server-side.
export function uploadPhoto(file: File, entity: "avatar"): Promise<string>;
export function uploadPhoto(
  file: File,
  entity: "ingredient" | "recipe",
  id: string,
): Promise<string>;
export async function uploadPhoto(
  file: File,
  entity: PhotoEntity,
  id?: string,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1024,
    fileType: "image/webp",
    useWebWorker: true,
  });

  const { data, error } = await supabase.functions.invoke<UploadUrlResponse>(
    "get-upload-url",
    {
      body: { entity, id },
    },
  );
  if (error) throw error;
  if (!data) throw new Error("Failed to get an upload URL. Try again.");

  const putResponse = await fetch(data.uploadUrl, {
    method: "PUT",
    body: compressed,
    headers: { "Content-Type": "image/webp" },
  });
  if (!putResponse.ok) {
    throw new Error("Failed to upload photo. Try again.");
  }

  return data.publicUrl;
}

// Deletes a photo's R2 object via the delete-photo Edge Function.
//
// For `entity: 'ingredient' | 'recipe'`, `id` is required, and this must be
// called before the row itself is removed from Dexie/the outbox — see
// deleteIngredient/deleteRecipe (entity-delete cleanup) — or, when just
// removing a photo without deleting the entity, after the field update
// that clears photo_url has already succeeded, not before (see
// IngredientForm.tsx/RecipeDetail.tsx's "remove photo" handling) — deleting
// from R2 first and then having the save fail would leave the row still
// pointing at a now-deleted object.
//
// For `entity: 'avatar'`, `id` is omitted — the Edge Function always keys
// it by the caller's own user id, same as uploadPhoto.
export function deletePhoto(entity: "avatar"): Promise<void>;
export function deletePhoto(
  entity: "ingredient" | "recipe",
  id: string,
): Promise<void>;
export async function deletePhoto(
  entity: PhotoEntity,
  id?: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-photo", {
    body: { entity, id },
  });
  if (error) throw error;
}
