import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

export const SUPABASE_ATTACHMENT_BUCKET =
  process.env.SUPABASE_ATTACHMENT_BUCKET?.trim() || "complaint-attachments";

export function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL?.trim() || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    anonKey: process.env.SUPABASE_ANON_KEY?.trim() || ""
  };
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const config = getSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  adminClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return adminClient;
}
