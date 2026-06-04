-- ============================================================
-- 001_picado_schema.sql
-- Tablas para el módulo "picado" (picados/partidos amateur)
-- Usar en el mismo proyecto Supabase con prefijo picado_
-- ============================================================

-- Grupos (cada club/grupo tiene su propio picado)
CREATE TABLE IF NOT EXISTS public.picado_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  slug        text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz DEFAULT now()
);

-- Jugadores de cada grupo
CREATE TABLE IF NOT EXISTS public.picado_players (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.picado_groups(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  apodo      text,
  posicion   text CHECK (posicion IN ('arquero','defensor','mediocampista','delantero','polifuncional')),
  nivel      integer NOT NULL DEFAULT 1200,
  activo     boolean NOT NULL DEFAULT true,
  codigo     text NOT NULL,  -- PIN del jugador, ej. 'NICO'
  created_at timestamptz DEFAULT now(),
  UNIQUE (group_id, codigo)
);

-- Partidos
CREATE TABLE IF NOT EXISTS public.picado_matches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           uuid NOT NULL REFERENCES public.picado_groups(id) ON DELETE CASCADE,
  fecha              date NOT NULL,
  hora               time NOT NULL,
  sede               text NOT NULL,
  formato            text NOT NULL DEFAULT '7v7',
  cupo_max           integer NOT NULL DEFAULT 14,
  estado             text NOT NULL DEFAULT 'programado'
                       CHECK (estado IN ('programado','abierto','cerrado','jugado','cancelado')),
  inscripcion_abre   timestamptz,
  inscripcion_cierra timestamptz,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS picado_matches_group_fecha
  ON public.picado_matches (group_id, fecha DESC);

-- Inscripciones
CREATE TABLE IF NOT EXISTS public.picado_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.picado_matches(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES public.picado_players(id) ON DELETE CASCADE,
  estado     text NOT NULL CHECK (estado IN ('titular','espera','baja')),
  orden      integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS picado_signups_match_estado_orden
  ON public.picado_signups (match_id, estado, orden);
