-- ============================================================
-- 012_picado_scoring_rules.sql
-- Guarda las reglas de puntuación del ranking por grupo.
-- Se almacenan como JSON en una columna del grupo para no crear
-- una tabla aparte. La app lee/escribe este objeto completo.
-- ============================================================

ALTER TABLE public.picado_groups
  ADD COLUMN IF NOT EXISTS scoring_rules jsonb;

-- RPC para actualizar las reglas de un grupo por slug.
-- SECURITY DEFINER porque el admin se maneja en la app (PIN/DNI) y
-- las tablas pueden tener RLS activo.
CREATE OR REPLACE FUNCTION public.picado_admin_save_rules(
  p_slug text,
  p_rules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
BEGIN
  UPDATE public.picado_groups
  SET scoring_rules = p_rules
  WHERE slug = p_slug
  RETURNING scoring_rules INTO v_rules;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  RETURN v_rules;
END;
$$;
