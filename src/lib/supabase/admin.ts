import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let cached: SupabaseClient | undefined;

/**
 * Service-role Supabase client for server-only use.
 * Do NOT import this from client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const env = getEnv();
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return cached;
}

