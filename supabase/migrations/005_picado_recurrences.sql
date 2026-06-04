-- ============================================================
-- 005_picado_recurrences.sql
-- Reglas de recurrencia de partidos + funciones de automatización
-- + habilitación de Realtime en picado_signups
-- ============================================================

-- ── Tabla de reglas de recurrencia ───────────────────────
-- DROP CASCADE para limpiar la versión anterior (columnas distintas)

DROP TABLE IF EXISTS public.picado_recurrences CASCADE;
CREATE TABLE public.picado_recurrences (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             uuid NOT NULL REFERENCES public.picado_groups(id) ON DELETE CASCADE,
  dia_semana           smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  -- 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
  hora                 time NOT NULL,
  sede                 text NOT NULL,
  formato              text NOT NULL DEFAULT '7v7',
  cupo_max             integer NOT NULL DEFAULT 14,
  abre_dias_antes      integer NOT NULL DEFAULT 7,
  -- cuántos días antes del partido se abre la inscripción
  cierra_horas_antes   integer NOT NULL DEFAULT 2,
  -- cuántas horas antes del partido se cierra la inscripción
  semanas_anticipacion integer NOT NULL DEFAULT 2,
  -- con cuántas semanas de anticipación materializar partidos
  activa               boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE public.picado_recurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "picado_recurrences_read" ON public.picado_recurrences;
CREATE POLICY "picado_recurrences_read" ON public.picado_recurrences
  FOR SELECT USING (activa = true);

-- ── Columna recurrence_id en picado_matches ───────────────

ALTER TABLE public.picado_matches
  ADD COLUMN IF NOT EXISTS recurrence_id uuid
  REFERENCES public.picado_recurrences(id) ON DELETE SET NULL;

-- Índice único parcial: un solo partido por recurrencia+fecha
-- Previene doble-materialización de forma idempotente
CREATE UNIQUE INDEX IF NOT EXISTS picado_matches_recurrence_fecha_uniq
  ON public.picado_matches (recurrence_id, fecha)
  WHERE recurrence_id IS NOT NULL;

-- ── Realtime para picado_signups ──────────────────────────
-- Habilita Supabase Realtime en la tabla de inscripciones
-- para que los clientes reciban cambios en tiempo real.
ALTER PUBLICATION supabase_realtime ADD TABLE public.picado_signups;

-- ── Función: picado_auto_open_close() ────────────────────
-- Abre partidos 'programado' cuando llega inscripcion_abre,
-- y cierra partidos 'abierto' cuando llega inscripcion_cierra.
-- Toda comparación en UTC; las timestamps se guardan en UTC
-- pero deben calcularse teniendo en cuenta America/Argentina/Buenos_Aires.
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.picado_auto_open_close();
CREATE OR REPLACE FUNCTION public.picado_auto_open_close()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ahora  timestamptz;
  v_count  integer := 0;
  v_rows   integer;
BEGIN
  v_ahora := now();

  -- Abrir inscripción cuando llega el momento
  UPDATE picado_matches
  SET estado = 'abierto'
  WHERE estado = 'programado'
    AND inscripcion_abre IS NOT NULL
    AND inscripcion_abre <= v_ahora;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- Cerrar inscripción cuando llega el momento
  UPDATE picado_matches
  SET estado = 'cerrado'
  WHERE estado = 'abierto'
    AND inscripcion_cierra IS NOT NULL
    AND inscripcion_cierra <= v_ahora;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  RETURN v_count;
END;
$$;

-- ── Función: picado_materialize_recurrences() ─────────────
-- Genera partidos a partir de las reglas de recurrencia.
-- Crea N semanas hacia adelante; idempotente (ON CONFLICT DO NOTHING).
-- Usa zona horaria America/Argentina/Buenos_Aires para calcular fechas.
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.picado_materialize_recurrences();
CREATE OR REPLACE FUNCTION public.picado_materialize_recurrences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          picado_recurrences%ROWTYPE;
  hoy          date;
  dow_hoy      integer;
  dias_hasta   integer;
  fecha_match  date;
  semana       integer;
  hora_match   timestamptz;
  abre_ts      timestamptz;
  cierra_ts    timestamptz;
  estado_nuevo text;
  v_count      integer := 0;
BEGIN
  -- Fecha actual en zona horaria Argentina
  hoy     := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  dow_hoy := EXTRACT(DOW FROM hoy)::integer;   -- 0=domingo

  FOR rec IN
    SELECT * FROM picado_recurrences WHERE activa = true
  LOOP
    -- Días hasta el próximo día_semana objetivo (0 = hoy mismo)
    dias_hasta := (rec.dia_semana - dow_hoy + 7) % 7;

    FOR semana IN 0..rec.semanas_anticipacion LOOP
      fecha_match := hoy + dias_hasta + (semana * 7);

      -- Hora del partido como timestamptz en Argentina
      hora_match := (fecha_match::text || ' ' || rec.hora::text)::timestamp
                    AT TIME ZONE 'America/Argentina/Buenos_Aires';

      -- Apertura de inscripción: N días antes, a la misma hora
      abre_ts := ((fecha_match - rec.abre_dias_antes)::text || ' ' || rec.hora::text)::timestamp
                 AT TIME ZONE 'America/Argentina/Buenos_Aires';

      -- Cierre de inscripción: N horas antes del partido
      cierra_ts := hora_match - (rec.cierra_horas_antes || ' hours')::interval;

      -- Estado inicial según si la inscripción ya debería estar abierta
      estado_nuevo := CASE
        WHEN now() >= abre_ts AND now() < cierra_ts THEN 'abierto'
        WHEN now() >= cierra_ts                      THEN 'cerrado'
        ELSE 'programado'
      END;

      -- Insertar solo si no existe ya un partido para esta recurrencia+fecha
      IF NOT EXISTS (
        SELECT 1 FROM picado_matches
        WHERE recurrence_id = rec.id AND fecha = fecha_match
      ) THEN
        INSERT INTO picado_matches (
          group_id, fecha, hora, sede, formato, cupo_max,
          estado, inscripcion_abre, inscripcion_cierra, recurrence_id
        ) VALUES (
          rec.group_id,
          fecha_match,
          rec.hora,
          rec.sede,
          rec.formato,
          rec.cupo_max,
          estado_nuevo,
          abre_ts,
          cierra_ts,
          rec.id
        );
        v_count := v_count + 1;
      END IF;

    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Seed: regla de ejemplo para FYP-FC ───────────────────
-- Miércoles 20:00, inscripción abre 7 días antes, cierra 2h antes
INSERT INTO public.picado_recurrences (
  id, group_id, dia_semana, hora, sede, formato, cupo_max,
  abre_dias_antes, cierra_horas_antes, semanas_anticipacion
)
SELECT
  'b0000001-0000-0000-0000-000000000001',
  id,
  3,             -- miércoles
  '20:00:00',
  'Cancha de Porro — Lugano',
  '7v7',
  14,
  7,
  2,
  3
FROM public.picado_groups WHERE slug = 'fyp-fc'
ON CONFLICT DO NOTHING;
