-- ============================================================
-- 027_picado_admin_audit.sql
-- Tabla de auditoria de acciones de admin + RPCs para escribir y
-- listar. El acceso pasa solo por las funciones SECURITY DEFINER;
-- la tabla no expone policies.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.picado_admin_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  admin_source    text NOT NULL DEFAULT 'unknown',
  accion          text NOT NULL,
  target_id       text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS picado_admin_audit_created_at_idx
  ON public.picado_admin_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS picado_admin_audit_admin_player_id_idx
  ON public.picado_admin_audit (admin_player_id);

ALTER TABLE public.picado_admin_audit ENABLE ROW LEVEL SECURITY;

-- RPC: registrar accion (best-effort, nunca rompe el flujo del caller)
CREATE OR REPLACE FUNCTION public.picado_admin_log(
  p_admin_player_id uuid,
  p_admin_source    text,
  p_accion          text,
  p_target_id       text,
  p_payload         jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_accion IS NULL OR btrim(p_accion) = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Accion requerida');
  END IF;

  INSERT INTO public.picado_admin_audit (
    admin_player_id, admin_source, accion, target_id, payload
  ) VALUES (
    p_admin_player_id,
    COALESCE(NULLIF(btrim(p_admin_source), ''), 'unknown'),
    btrim(p_accion),
    NULLIF(btrim(COALESCE(p_target_id, '')), ''),
    COALESCE(p_payload, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id::text);
END;
$$;

-- RPC: listar auditoria (mas nuevo primero) con datos del admin
CREATE OR REPLACE FUNCTION public.picado_admin_list_logs(
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id              uuid,
  admin_player_id uuid,
  admin_nombre    text,
  admin_apodo     text,
  admin_source    text,
  accion          text,
  target_id       text,
  payload         jsonb,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.admin_player_id,
    p.nombre,
    p.apodo,
    a.admin_source,
    a.accion,
    a.target_id,
    a.payload,
    a.created_at
  FROM public.picado_admin_audit a
  LEFT JOIN public.players p ON p.id = a.admin_player_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

GRANT EXECUTE ON FUNCTION public.picado_admin_log(uuid, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.picado_admin_list_logs(int) TO anon, authenticated;
