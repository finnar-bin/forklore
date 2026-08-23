import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

// Presigns an R2 PUT upload URL for a client-compressed WebP photo. Never
// touches file bytes — see docs/rpcs.md's get-upload-url contract.
//
// supabase/config.toml's verify_jwt only checks that the Authorization
// header carries *some* validly-signed Supabase JWT — the public anon key
// (necessarily shipped in every client bundle) is itself one, so verify_jwt
// alone does not distinguish a real signed-in user from anyone holding the
// anon key. The actual "must be authenticated" check happens below via
// auth.getUser(), which rejects the anon key (it doesn't correspond to a
// real user) and any missing/invalid token.
//
// Object keys are named by entity id (ingredient/recipe id, or the caller's
// own user id for avatars), not a random UUID, so re-uploading a photo for
// the same entity overwrites the previous object in R2 instead of
// accumulating orphaned ones. Because the id now determines what gets
// overwritten, a client-supplied ingredient/recipe id is verified against
// RLS before signing (the id-resolution branch below).

const PATH_PREFIXES = {
  ingredient: 'ingredient-photos',
  recipe: 'recipe-photos',
  avatar: 'avatar-photos',
} as const;

type Entity = keyof typeof PATH_PREFIXES;

const OWNERSHIP_TABLES = {
  ingredient: 'ingredients',
  recipe: 'recipes',
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return errorResponse('Missing Authorization header.', 401);
  }

  // Auto-injected by the Supabase platform into every deployed Edge
  // Function — not something set via `supabase secrets set`. The
  // Authorization header is forwarded to every request this client makes,
  // so table queries below run RLS-scoped as the caller, not as anon.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse('Server misconfiguration: missing Supabase project env vars.', 500);
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData.user) {
    return errorResponse('Unauthorized.', 401);
  }

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
    if (entity !== 'avatar' && body.id !== undefined) {
      if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) {
        throw new Error('invalid id');
      }
      requestedId = body.id;
    }
  } catch {
    return errorResponse('entity must be one of ingredient, recipe, avatar; id, if present, must be a UUID', 400);
  }

  // Resolve which id actually names the R2 object:
  // - avatar: always the caller's own id — never client-influenced, so a
  //   user can only ever overwrite their own avatar.
  // - ingredient/recipe with an id: verified below via RLS before use.
  // - ingredient/recipe with no id (a not-yet-created row, i.e. the create
  //   flow): a fresh random id — nothing exists yet to authorize against or
  //   to overwrite.
  let id: string;
  if (entity === 'avatar') {
    id = userData.user.id;
  } else if (requestedId) {
    const table = OWNERSHIP_TABLES[entity];
    const { data: row, error: rowError } = await userClient.from(table).select('id').eq('id', requestedId).maybeSingle();
    if (rowError) {
      // Logged server-side (not returned to the client, to avoid leaking
      // details) so a genuine backend problem here — bad table name,
      // transient PostgREST failure, RLS misconfiguration — is
      // distinguishable from an ordinary unauthorized attempt when
      // reading Edge Function logs.
      console.error('get-upload-url ownership check failed:', rowError);
    }
    if (rowError || !row) {
      return errorResponse('Not found or not authorized.', 403);
    }
    id = requestedId;
  } else {
    id = crypto.randomUUID();
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
