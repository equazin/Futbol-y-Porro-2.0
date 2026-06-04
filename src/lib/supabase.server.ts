import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client.
// Reads env vars from process.env (server context) — never bundled into client JS.
// The publishable key is safe for calling SECURITY DEFINER RPCs from the server.
export function getSupabase() {
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, key);
}
