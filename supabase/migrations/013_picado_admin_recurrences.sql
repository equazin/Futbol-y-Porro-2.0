-- ============================================================
-- 013_picado_admin_recurrences.sql
-- Operaciones admin sobre las reglas de recurrencia (picado_recurrences).
-- El admin se maneja en la app (PIN/DNI) y la tabla tiene RLS (solo SELECT
-- de reglas activas), así que las escrituras van por RPC SECURITY DEFINER.
-- Las funciones de materializar/abrir-cerrar ya existen (migración 005).
-- ============================================================

-- ── Crear o actualizar una regla de recurrencia ──────────
-- Si p_id es NULL se inserta; si viene un id, se actualiza esa regla.
CREATE OR REPLACE FUNCTION public.picado_admin_save_recurrence(
  p_id                   uuid,
  p_slug                 text,
  p_dia_semana           smallint,
  p_hora                 time,
  p_sede                 text,
  p_formato              text,
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
BEGIN
  SELECT id INTO v_group_id FROM public.picado_groups WHERE slug = p_slug;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  IF p_dia_semana < 0 OR p_dia_semana > 6 THEN
    RAISE EXCEPTION 'Día de semana inválido (0-6)';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.picado_recurrences (
      group_id, dia_semana, hora, sede, formato, cupo_max,
      abre_dias_antes, cierra_horas_antes, semanas_anticipacion, activa
    ) VALUES (
      v_group_id, p_dia_semana, p_hora, p_sede,
      COALESCE(NULLIF(trim(p_formato), ''), '7v7'),
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

-- ── Eliminar una regla de recurrencia ────────────────────
CREATE OR REPLACE FUNCTION public.picado_admin_delete_recurrence(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.picado_recurrences WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regla de recurrencia no encontrada';
  END IF;
END;
$$;

-- ── Listado admin de reglas (incluye inactivas) ──────────
-- La policy RLS solo deja ver las activas; esta RPC SECURITY DEFINER
-- permite al admin ver todas (activas e inactivas) para gestionarlas.
CREATE OR REPLACE FUNCTION public.picado_admin_list_recurrences(p_slug text)
RETURNS SETOF public.picado_recurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.picado_groups WHERE slug = p_slug;
  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT * FROM public.picado_recurrences
    WHERE group_id = v_group_id
    ORDER BY dia_semana, hora;
END;
$$;
