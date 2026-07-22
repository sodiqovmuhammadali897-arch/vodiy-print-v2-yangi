import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const configured = Boolean(url && anon);

const missing: string[] = [
  ...(url ? [] : ["VITE_SUPABASE_URL"]),
  ...(anon ? [] : ["VITE_SUPABASE_ANON_KEY"]),
];

const client: SupabaseClient = configured
  ? createClient(url as string, anon as string, {
      auth: { persistSession: false },
    })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "Supabase mijozi sozlanmagan. VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY environment variable'larini qo'shing.",
          );
        },
      },
    ) as unknown as SupabaseClient);

export const isSupabaseConfigured = configured;
export const missingSupabaseKeys = missing;
export const supabase = client;
