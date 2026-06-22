import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily create the server-side admin client on first use, so importing this
// module during `next build` doesn't require env vars to be present.
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  // The service role key bypasses RLS, so this must only run server-side.
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
