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

const PATH_PREFIXES = {
  ingredient: 'ingredient-photos',
  recipe: 'recipe-photos',
  avatar: 'avatar-photos',
} as const;

type Entity = keyof typeof PATH_PREFIXES;

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

  // These two are auto-injected by the Supabase platform into every
  // deployed Edge Function — not something that needs to be set via
  // `supabase secrets set`.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse('Server misconfiguration: missing Supabase project env vars.', 500);
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !userData.user) {
    return errorResponse('Unauthorized.', 401);
  }

  let entity: Entity;
  try {
    const body = await req.json();
    if (!Object.hasOwn(PATH_PREFIXES, body?.entity)) {
      throw new Error('invalid entity');
    }
    entity = body.entity as Entity;
  } catch {
    return errorResponse('entity must be one of ingredient, recipe, avatar', 400);
  }

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  const publicUrl = Deno.env.get('R2_PUBLIC_URL');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return errorResponse('Server misconfiguration: missing R2 secrets.', 500);
  }

  const key = `${PATH_PREFIXES[entity]}/${crypto.randomUUID()}.webp`;

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

  return new Response(JSON.stringify({ uploadUrl: signed.url, publicUrl: `${publicUrl}/${key}` }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
