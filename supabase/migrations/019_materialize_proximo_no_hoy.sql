-- ============================================================
-- 019_materialize_proximo_no_hoy.sql
-- Ajuste: si el día de la regla coincide con HOY, generar el partido
-- de la semana que viene (no el de hoy mismo). El partido recurrente
-- siempre apunta al próximo día objetivo a futuro.
-- (Antes, (dia_semana - dow_hoy + 7) % 7 daba 0 cuando era hoy.)
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
  hora_match   timestamptz;
  abre_ts      timestamptz;
  cierra_ts    timestamptz;
  estado_nuevo text;
  v_count      integer := 0;
BEGIN
  hoy     := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  dow_hoy := EXTRACT(DOW FROM hoy)::integer;

  FOR rec IN SELECT * FROM picado_recurrences WHERE activa = true LOOP
    -- Días hasta el próximo día_semana objetivo.
    -- Si cae hoy mismo (0), saltamos a la semana que viene (7).
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
        group_id, fecha, hora, sede, formato, cupo_max,
        estado, inscripcion_abre, inscripcion_cierra, recurrence_id
      ) VALUES (
        rec.group_id, fecha_match, rec.hora, rec.sede, rec.formato, rec.cupo_max,
        estado_nuevo, abre_ts, cierra_ts, rec.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
