// ============================================================
// supabase/functions/picado-scheduled/index.ts
//
// Edge Function que ejecuta las dos tareas de automatización:
//   1. picado_materialize_recurrences() — crea partidos futuros
//   2. picado_auto_open_close()         — actualiza estados
//
// Cómo programarla (sin pg_cron):
//   Dashboard → Edge Functions → picado-scheduled → Schedule
//   Cron expression: "*/5 * * * *" (cada 5 min)
//   O: "0 3 * * *" para solo materializar una vez por día.
//
// El service role key está disponible automáticamente en
// Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') dentro de Edge Functions.
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Materializar partidos recurrentes
  try {
    const { data, error } = await sb.rpc("picado_materialize_recurrences");
    results.materialize = error
      ? { ok: false, error: error.message }
      : { ok: true, created: data };
  } catch (e) {
    results.materialize = { ok: false, error: String(e) };
  }

  // 2. Abrir/cerrar inscripciones
  try {
    const { data, error } = await sb.rpc("picado_auto_open_close");
    results.auto_open_close = error
      ? { ok: false, error: error.message }
      : { ok: true, changed: data };
  } catch (e) {
    results.auto_open_close = { ok: false, error: String(e) };
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
