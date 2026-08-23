import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import {
  PATH_PREFIXES,
  OWNERSHIP_TABLES,
  UUID_RE,
  CORS_HEADERS,
  errorResponse,
  authenticateCaller,
  createServiceClient,
  isVisibleToCaller,
  isPhotoStillReferenced,
  type Entity,
} from '../_shared/photoAuth.ts';

// Deletes an ingredient/recipe's R2 photo when the row itself is deleted
// (called from deleteIngredient/deleteRecipe), or an avatar's when it's
// removed from a profile (ProfileForm.tsx/AboutYouStep.tsx's "remove
// photo" action).
//
// For ingredient/recipe, this is called BEFORE the row is actually removed
// from Dexie/the outbox — the ownership check below needs the row to
// still exist to verify the caller could see it; if it ran after the row
// was gone, every legitimate deletion would incorrectly 403.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const auth = await authenticateCaller(req);
  if (!auth.ok) return auth.response;
  const { userClient, userId } = auth;

  let entity: Entity;
  let requestedId: string | undefined;
  try {
    const body = await req.json();
    if (!Object.hasOwn(PATH_PREFIXES, body?.entity)) {
      throw new Error('invalid entity');
    }
    entity = body.entity as Entity;
    // Avatars are always keyed by the caller's own id (resolved below) —
    // any id the client sends for entity: 'avatar' is meaningless and
    // discarded, so it's never even validated. Same convention as
    // get-upload-url.
    if (entity !== 'avatar') {
      if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) {
        throw new Error('invalid id');
      }
      requestedId = body.id;
    }
  } catch {
    return errorResponse('entity must be one of ingredient, recipe, avatar; ingredient/recipe also require an id (UUID)', 400);
  }

  let id: string;
  if (entity === 'avatar') {
    // No ownership check needed beyond authentication itself — a caller
    // can only ever delete their own avatar, since the id isn't
    // client-influenced. No reference check either: avatars are never
    // shared/copied across rows the way ingredient/recipe photos can be
    // via copy_ingredient/copy_recipe.
    id = userId;
  } else {
    if (!requestedId) {
      return errorResponse('id is required for entity ingredient/recipe', 400);
    }
    const table = OWNERSHIP_TABLES[entity];
    const visible = await isVisibleToCaller(userClient, table, requestedId, 'delete-photo');
    if (!visible) {
      return errorResponse('Not found or not authorized.', 403);
    }
    id = requestedId;

    const key = `${PATH_PREFIXES[entity]}/${id}.webp`;
    const serviceClientResult = createServiceClient();
    if (!serviceClientResult.ok) return serviceClientResult.response;

    const stillReferenced = await isPhotoStillReferenced(serviceClientResult.client, table, id, key, 'delete-photo');
    if (stillReferenced) {
      // Not an error — a copy (Ticket 14's copy_ingredient/copy_recipe,
      // which copies photo_url verbatim rather than giving a copy its own
      // independent photo) still needs this object. Nothing to delete.
      return new Response(JSON.stringify({ deleted: false }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  const key = `${PATH_PREFIXES[entity]}/${id}.webp`;

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return errorResponse('Server misconfiguration: missing R2 secrets.', 500);
  }

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  // No presigning-then-handing-a-URL-to-the-client needed here, unlike
  // upload — a DELETE carries no body/bytes, so the server can just
  // perform it directly via aws4fetch's signing fetch wrapper.
  const deleteResponse = await client.fetch(objectUrl, { method: 'DELETE' });
  // R2/S3 DELETE is idempotent — a 404 (nothing was ever uploaded for this
  // entity) is a normal outcome, not an error.
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    console.error('delete-photo: R2 delete failed', deleteResponse.status, await deleteResponse.text());
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
