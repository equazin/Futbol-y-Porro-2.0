-- ============================================================
-- 021_picado_match_type_fecha_fifa.sql
-- Agrega tipo de partido:
-- - oficial: cuenta para ranking
-- - fecha_fifa: amistoso/diversion, no suma puntos a la tabla
-- ============================================================

ALTER TABLE public.picado_matches
  ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'oficial';

ALTER TABLE public.picado_recurrences
  ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'oficial';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'picado_matches_match_type_check'
      AND conrelid = 'public.picado_matches'::regclass
  ) THEN
    ALTER TABLE public.picado_matches
      ADD CONSTRAINT picado_matches_match_type_check
      CHECK (match_type IN ('oficial', 'fecha_fifa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'picado_recurrences_match_type_check'
      AND conrelid = 'public.picado_recurrences'::regclass
  ) THEN
    ALTER TABLE public.picado_recurrences
      ADD CONSTRAINT picado_recurrences_match_type_check
      CHECK (match_type IN ('oficial', 'fecha_fifa'));
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.picado_admin_save_recurrence(
  uuid,
  text,
  smallint,
  time,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  boolean
);

CREATE OR REPLACE FUNCTION public.picado_admin_save_recurrence(
  p_id                   uuid,
  p_slug                 text,
  p_dia_semana           smallint,
  p_hora                 time,
  p_sede                 text,
  p_formato              text,
  p_match_type           text,
  p_cupo_max             integer,
  p_abre_dias_antes      integer,
  p_cierra_horas_antes   integer,
  p_semanas_anticipacion integer,
  p_activa               boolean
)
RETURNS public.picado_recurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_rec      public.picado_recurrences%ROWTYPE;
  v_match_type text;
BEGIN
  SELECT id INTO v_group_id FROM public.picado_groups WHERE slug = p_slug;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  IF p_dia_semana < 0 OR p_dia_semana > 6 THEN
    RAISE EXCEPTION 'Dia de semana invalido (0-6)';
  END IF;

  v_match_type := COALESCE(NULLIF(trim(p_match_type), ''), 'oficial');
  IF v_match_type NOT IN ('oficial', 'fecha_fifa') THEN
    RAISE EXCEPTION 'Tipo de partido invalido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.picado_recurrences (
      group_id, dia_semana, hora, sede, formato, match_type, cupo_max,
      abre_dias_antes, cierra_horas_antes, semanas_anticipacion, activa
    ) VALUES (
      v_group_id, p_dia_semana, p_hora, p_sede,
      COALESCE(NULLIF(trim(p_formato), ''), '7v7'),
      v_match_type,
      COALESCE(p_cupo_max, 14),
      COALESCE(p_abre_dias_antes, 7),
      COALESCE(p_cierra_horas_antes, 2),
      COALESCE(p_semanas_anticipacion, 2),
      COALESCE(p_activa, true)
    )
    RETURNING * INTO v_rec;
  ELSE
    UPDATE public.picado_recurrences
    SET dia_semana           = p_dia_semana,
        hora                 = p_hora,
        sede                 = p_sede,
        formato              = COALESCE(NULLIF(trim(p_formato), ''), formato),
        match_type           = v_match_type,
        cupo_max             = COALESCE(p_cupo_max, cupo_max),
        abre_dias_antes      = COALESCE(p_abre_dias_antes, abre_dias_antes),
        cierra_horas_antes   = COALESCE(p_cierra_horas_antes, cierra_horas_antes),
        semanas_anticipacion = COALESCE(p_semanas_anticipacion, semanas_anticipacion),
        activa               = COALESCE(p_activa, activa)
    WHERE id = p_id AND group_id = v_group_id
    RETURNING * INTO v_rec;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Regla de recurrencia no encontrada';
    END IF;
  END IF;

  RETURN v_rec;
END;
$$;

DROP FUNCTION IF EXISTS public.picado_materialize_recurrences();
DROP FUNCTION IF EXISTS public.picado_materialize_recurrences(integer);

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
  hora_match   timestamptz;
  abre_ts      timestamptz;
  cierra_ts    timestamptz;
  estado_nuevo text;
  v_count      integer := 0;
BEGIN
  hoy     := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  dow_hoy := EXTRACT(DOW FROM hoy)::integer;

  FOR rec IN SELECT * FROM picado_recurrences WHERE activa = true LOOP
    dias_hasta := (rec.dia_semana - dow_hoy + 7) % 7;
    IF dias_hasta = 0 THEN
      dias_hasta := 7;
    END IF;
    fecha_match := hoy + dias_hasta;

    hora_match := (fecha_match::text || ' ' || rec.hora::text)::timestamp
                  AT TIME ZONE 'America/Argentina/Buenos_Aires';
    abre_ts := ((fecha_match - rec.abre_dias_antes)::text || ' ' || rec.hora::text)::timestamp
               AT TIME ZONE 'America/Argentina/Buenos_Aires';
    cierra_ts := hora_match - (rec.cierra_horas_antes || ' hours')::interval;

    estado_nuevo := CASE
      WHEN now() >= abre_ts AND now() < cierra_ts THEN 'abierto'
      WHEN now() >= cierra_ts                      THEN 'cerrado'
      ELSE 'programado'
    END;

    IF NOT EXISTS (
      SELECT 1 FROM picado_matches
      WHERE recurrence_id = rec.id AND fecha = fecha_match
    ) THEN
      INSERT INTO picado_matches (
        group_id, fecha, hora, sede, formato, match_type, cupo_max,
        estado, inscripcion_abre, inscripcion_cierra, recurrence_id
      ) VALUES (
        rec.group_id, fecha_match, rec.hora, rec.sede, rec.formato,
        COALESCE(rec.match_type, 'oficial'), rec.cupo_max,
        estado_nuevo, abre_ts, cierra_ts, rec.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
