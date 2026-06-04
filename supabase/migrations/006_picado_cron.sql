-- ============================================================
-- 006_picado_cron.sql — OPCIONAL: requiere extensión pg_cron
-- ============================================================
-- Para habilitar pg_cron: Dashboard → Database → Extensions → pg_cron
--
-- Si no podés activarla, usá la Edge Function `picado-scheduled`
-- en combinación con el scheduler de Supabase (Dashboard → Functions).
-- ============================================================

-- Verificar que pg_cron esté disponible
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Todos los horarios en UTC.
-- America/Argentina/Buenos_Aires = UTC-3 (sin horario de verano).
-- Para ejecutar algo a las 00:00 ART → usar las 03:00 UTC.

-- ── Job 1: Abrir/cerrar inscripciones ────────────────────
-- Cada 5 minutos: actualiza estado de partidos según timestamps
SELECT cron.schedule(
  'picado-auto-open-close',
  '*/5 * * * *',
  $$ SELECT public.picado_auto_open_close(); $$
);

-- ── Job 2: Materializar partidos recurrentes ─────────────
-- Todos los días a las 03:00 UTC (00:00 ART)
SELECT cron.schedule(
  'picado-materialize-recurrences',
  '0 3 * * *',
  $$ SELECT public.picado_materialize_recurrences(); $$
);

-- Para ver los jobs activos:
-- SELECT * FROM cron.job;

-- Para desactivar/eliminar un job:
-- SELECT cron.unschedule('picado-auto-open-close');
-- SELECT cron.unschedule('picado-materialize-recurrences');
