import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import {
  PATH_PREFIXES,
  OWNERSHIP_TABLES,
  UUID_RE,
  CORS_HEADERS,
  errorResponse,
  authenticateCaller,
  createServiceClient,
  existsAnywhere,
  isVisibleToCaller,
  type Entity,
} from '../_shared/photoAuth.ts';

// Presigns an R2 PUT upload URL for a client-compressed WebP photo. Never
// touches file bytes — see docs/rpcs.md's get-upload-url contract.
//
// Object keys are named by entity id (ingredient/recipe id, or the caller's
// own user id for avatars), not a random UUID, so re-uploading a photo for
// the same entity overwrites the previous object in R2 instead of
// accumulating orphaned ones. Upload now happens at form-submit time
// (src/components/DeferredPhotoUpload.tsx), by which point the entity's
// real id is always already known — client-generated for a not-yet-created
// row (src/features/pantry/api.ts's createIngredient generates its id the
// same way, before any server round-trip), or the existing row's id for an
// edit — so `id` is required for ingredient/recipe, not optional.

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
    // discarded, so it's never even validated.
    if (entity !== 'avatar') {
      if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) {
        throw new Error('invalid id');
      }
      requestedId = body.id;
    }
  } catch {
    return errorResponse(
      'entity must be one of ingredient, recipe, avatar; ingredient/recipe also require an id (UUID)',
      400,
    );
  }

  // Resolve which id actually names the R2 object:
  // - avatar: always the caller's own id — never client-influenced, so a
  //   user can only ever overwrite their own avatar.
  // - ingredient/recipe: the id might refer to an existing row (an edit —
  //   must be visible to the caller under RLS) or a not-yet-created row
  //   (a create — the id is a fresh client-generated UUID that doesn't
  //   exist in Postgres yet). A caller-scoped query can't tell these two
  //   cases apart (RLS hides both identically), so existence is checked
  //   via a service-role client first; only an *existing* row needs the
  //   caller-visibility check.
  let id: string;
  if (entity === 'avatar') {
    id = userId;
  } else {
    if (!requestedId) {
      return errorResponse('id is required for entity ingredient/recipe', 400);
    }
    const table = OWNERSHIP_TABLES[entity];
    const serviceClientResult = createServiceClient();
    if (!serviceClientResult.ok) return serviceClientResult.response;

    const alreadyExists = await existsAnywhere(serviceClientResult.client, table, requestedId, 'get-upload-url');
    if (alreadyExists) {
      const visible = await isVisibleToCaller(userClient, table, requestedId, 'get-upload-url');
      if (!visible) {
        return errorResponse('Not found or not authorized.', 403);
      }
    }
    id = requestedId;
  }

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  const publicUrl = Deno.env.get('R2_PUBLIC_URL');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return errorResponse('Server misconfiguration: missing R2 secrets.', 500);
  }

  const key = `${PATH_PREFIXES[entity]}/${id}.webp`;

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
  objectUrl.searchParams.set('X-Amz-Expires', '300');

  // Content-Type is deliberately signed here (unlike a fully header-free
  // presign) — the client always sends exactly this value (src/lib/photoUpload.ts),
  // so signing it costs nothing and constrains the presigned URL to only
  // accept a webp upload, not an arbitrary file type, within its 5-minute
  // window. This doesn't validate body bytes or enforce a size limit — see
  // docs/pending-deviations.md (Ticket 15) for that residual gap.
  const signed = await client.sign(objectUrl.toString(), {
    method: 'PUT',
    headers: { 'content-type': 'image/webp' },
    aws: { signQuery: true },
  });

  // The R2 object key is deterministic (entity id) so a re-upload
  // overwrites the previous object rather than leaving it orphaned — but
  // the *returned* URL still gets a fresh cache-busting query string each
  // time, so a browser/CDN cache keyed on the old URL+bytes never serves a
  // stale image after a photo is replaced. This value is what gets stored
  // as photo_url/avatar_url, so every upload produces a distinct stored URL
  // even though the same key is repeatedly overwritten in storage.
  const publicUrlWithCacheBust = `${publicUrl}/${key}?v=${Date.now()}`;

  return new Response(JSON.stringify({ uploadUrl: signed.url, publicUrl: publicUrlWithCacheBust }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
