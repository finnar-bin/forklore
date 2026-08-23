import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Shared between get-upload-url and delete-photo: CORS, the "is this a
// real signed-in user" check, and the RLS-scoped/service-role queries both
// functions need to authorize an id-keyed R2 object.

export const PATH_PREFIXES = {
  ingredient: 'ingredient-photos',
  recipe: 'recipe-photos',
  avatar: 'avatar-photos',
} as const;

export type Entity = keyof typeof PATH_PREFIXES;

export const OWNERSHIP_TABLES = {
  ingredient: 'ingredients',
  recipe: 'recipes',
} as const;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // x-client-info and apikey aren't headers either function reads itself —
  // they're sent automatically by supabase-js's functions.invoke() on
  // every call, so the preflight has to allow them or the browser blocks
  // the real request before it's ever sent ("header disallowed by
  // preflight response").
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface AuthSuccess {
  ok: true;
  userClient: SupabaseClient;
  userId: string;
}
interface AuthFailure {
  ok: false;
  response: Response;
}

// verify_jwt (supabase/config.toml) only checks that the Authorization
// header carries *some* validly-signed Supabase JWT — the public anon key
// (necessarily shipped in every client bundle) is itself one, so it alone
// does not distinguish a real signed-in user from anyone holding the anon
// key. auth.getUser() below is the actual "must be authenticated" check —
// it rejects the anon key (it doesn't correspond to a real user) and any
// missing/invalid token. The returned userClient forwards the caller's own
// JWT on every request it makes, so subsequent table queries run
// RLS-scoped as the caller, not as anon.
export async function authenticateCaller(req: Request): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { ok: false, response: errorResponse('Missing Authorization header.', 401) };
  }

  // Auto-injected by the Supabase platform into every deployed Edge
  // Function — not something set via `supabase secrets set`.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: errorResponse('Server misconfiguration: missing Supabase project env vars.', 500) };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData.user) {
    return { ok: false, response: errorResponse('Unauthorized.', 401) };
  }

  return { ok: true, userClient, userId: userData.user.id };
}

interface ServiceClientSuccess {
  ok: true;
  client: SupabaseClient;
}
interface ServiceClientFailure {
  ok: false;
  response: Response;
}

// Also auto-injected by the Supabase platform, same as SUPABASE_URL/
// SUPABASE_ANON_KEY — not a secret either function needs to set itself.
// Bypasses RLS entirely; used only for narrow, boolean, id-only existence
// checks below — never to return row contents to the client.
export function createServiceClient(): ServiceClientSuccess | ServiceClientFailure {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, response: errorResponse('Server misconfiguration: missing service role env vars.', 500) };
  }
  return { ok: true, client: createClient(supabaseUrl, serviceRoleKey) };
}

// Does a row with this id exist AT ALL, regardless of who can see it?
// Service-role, so RLS never hides an existing row from this check — the
// whole point is to tell "doesn't exist anywhere" apart from "exists, but
// hidden from this particular caller," which an RLS-scoped query alone
// cannot do (both look identical: nothing comes back).
export async function existsAnywhere(
  serviceClient: SupabaseClient,
  table: string,
  id: string,
  logContext: string,
): Promise<boolean> {
  const { data, error } = await serviceClient.from(table).select('id').eq('id', id).maybeSingle();
  if (error) {
    console.error(`${logContext}: existence check failed`, error);
    // Fail closed: if existence can't be determined, don't assume "safe,
    // brand-new row" — fall through to requiring the stricter
    // caller-visibility check instead.
    return true;
  }
  return data !== null;
}

// Can the caller see this row under their own RLS policies? For
// ingredients/recipes, the select and update policies use the identical
// `using` predicate (confirmed by reading
// supabase/migrations/20260819000000_phase1_schema.sql), so this is
// exactly equivalent to "the caller may write to this row," not just an
// approximation.
export async function isVisibleToCaller(
  userClient: SupabaseClient,
  table: string,
  id: string,
  logContext: string,
): Promise<boolean> {
  const { data, error } = await userClient.from(table).select('id').eq('id', id).maybeSingle();
  if (error) {
    // Logged server-side (not returned to the client, to avoid leaking
    // details) so a genuine backend problem here — bad table name,
    // transient PostgREST failure, RLS misconfiguration — is
    // distinguishable from an ordinary unauthorized attempt when reading
    // Edge Function logs.
    console.error(`${logContext}: visibility check failed`, error);
    return false;
  }
  return data !== null;
}

// Does any OTHER row (any user, any group) still have a photo_url
// referencing this R2 key? copy_ingredient/copy_recipe (Ticket 14) copy
// photo_url verbatim into the new row rather than giving a copy its own
// independent photo, so a copy's photo_url can point at its *source's* R2
// object — deleting the source's object out from under a still-live copy
// would be a real regression. Service-role, since a copy can live in a
// group this caller has no access to — an RLS-scoped query would miss it
// and wrongly conclude "safe to delete."
export async function isPhotoStillReferenced(
  serviceClient: SupabaseClient,
  table: string,
  excludeId: string,
  key: string,
  logContext: string,
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from(table)
    .select('id')
    .neq('id', excludeId)
    .like('photo_url', `%${key}%`)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`${logContext}: reference check failed`, error);
    // Fail closed the other direction here — if this can't be confirmed,
    // don't delete. A false "still referenced" just leaves one object
    // un-cleaned-up (the pre-existing accepted risk this feature already
    // lives with elsewhere); a false "not referenced" would wrongly break
    // someone else's copy.
    return true;
  }
  return data !== null;
}
