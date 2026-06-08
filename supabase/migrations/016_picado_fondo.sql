-- ============================================================
-- 016_picado_fondo.sql
-- Fondo Común del grupo (libro de caja): movimientos de ingreso/egreso.
-- Lectura pública (cualquiera ve el saldo), escritura solo admin vía RPC.
-- ============================================================

-- ── Tabla de movimientos ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.picado_fondo_movimientos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.picado_groups(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  concepto   text NOT NULL,
  monto      numeric(12, 2) NOT NULL CHECK (monto >= 0),
  fecha      date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS picado_fondo_group_fecha
  ON public.picado_fondo_movimientos (group_id, fecha DESC);

-- ── RLS: lectura pública, escritura solo via RPC ─────────
ALTER TABLE public.picado_fondo_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "picado_fondo_select" ON public.picado_fondo_movimientos;
CREATE POLICY "picado_fondo_select" ON public.picado_fondo_movimientos
  FOR SELECT USING (true);

-- ── RPC: crear o actualizar un movimiento ────────────────
-- Si p_id es NULL inserta; si viene un id, actualiza ese movimiento.
CREATE OR REPLACE FUNCTION public.picado_admin_save_movimiento(
  p_id       uuid,
  p_slug     text,
  p_tipo     text,
  p_concepto text,
  p_monto    numeric,
  p_fecha    date
)
RETURNS public.picado_fondo_movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_mov      public.picado_fondo_movimientos%ROWTYPE;
BEGIN
  SELECT id INTO v_group_id FROM public.picado_groups WHERE slug = p_slug;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  IF p_tipo NOT IN ('ingreso', 'egreso') THEN
    RAISE EXCEPTION 'Tipo inválido (ingreso/egreso)';
  END IF;
  IF trim(COALESCE(p_concepto, '')) = '' THEN
    RAISE EXCEPTION 'Concepto requerido';
  END IF;
  IF COALESCE(p_monto, -1) < 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.picado_fondo_movimientos (group_id, tipo, concepto, monto, fecha)
    VALUES (v_group_id, p_tipo, trim(p_concepto), p_monto, COALESCE(p_fecha, current_date))
    RETURNING * INTO v_mov;
  ELSE
    UPDATE public.picado_fondo_movimientos
    SET tipo     = p_tipo,
        concepto = trim(p_concepto),
        monto    = p_monto,
        fecha    = COALESCE(p_fecha, fecha)
    WHERE id = p_id AND group_id = v_group_id
    RETURNING * INTO v_mov;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movimiento no encontrado';
    END IF;
  END IF;

  RETURN v_mov;
END;
$$;

-- ── RPC: eliminar un movimiento ──────────────────────────
CREATE OR REPLACE FUNCTION public.picado_admin_delete_movimiento(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.picado_fondo_movimientos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;
END;
$$;
