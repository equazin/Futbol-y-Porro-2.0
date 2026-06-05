-- ============================================================
-- 015_fix_materialize_overload.sql
-- Fix: existían DOS versiones de picado_materialize_recurrences
--   - picado_materialize_recurrences()
--   - picado_materialize_recurrences(integer)  (p_weeks_ahead, versión vieja)
-- PostgREST no podía resolver cuál llamar → error PGRST203 (300 Multiple
-- Choices) al tocar "Generar próximos partidos ahora".
-- Se eliminan ambas y se recrea una sola sin argumentos (la que usa la app).
-- ============================================================

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
  semana       integer;
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

    FOR semana IN 0..rec.semanas_anticipacion LOOP
      fecha_match := hoy + dias_hasta + (semana * 7);

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
          group_id, fecha, hora, sede, formato, cupo_max,
          estado, inscripcion_abre, inscripcion_cierra, recurrence_id
        ) VALUES (
          rec.group_id, fecha_match, rec.hora, rec.sede, rec.formato, rec.cupo_max,
          estado_nuevo, abre_ts, cierra_ts, rec.id
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;
