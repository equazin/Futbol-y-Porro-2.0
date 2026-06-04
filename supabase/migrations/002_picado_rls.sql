-- ============================================================
-- 002_picado_rls.sql
-- Row Level Security: lectura pública, escritura solo via RPC
-- ============================================================

ALTER TABLE public.picado_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picado_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picado_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picado_signups ENABLE ROW LEVEL SECURITY;

-- Grupos: lectura pública
CREATE POLICY "picado_groups_select" ON public.picado_groups
  FOR SELECT USING (true);

-- Jugadores: lectura pública (solo activos)
CREATE POLICY "picado_players_select" ON public.picado_players
  FOR SELECT USING (activo = true);

-- Partidos: lectura pública
CREATE POLICY "picado_matches_select" ON public.picado_matches
  FOR SELECT USING (true);

-- Inscripciones: lectura pública (sin bajas)
CREATE POLICY "picado_signups_select" ON public.picado_signups
  FOR SELECT USING (estado <> 'baja');

-- NOTA: No hay políticas de INSERT/UPDATE/DELETE para anon.
-- Todas las escrituras pasan por funciones SECURITY DEFINER
-- (anotarse, bajarse) que se ejecutan con permisos elevados.
