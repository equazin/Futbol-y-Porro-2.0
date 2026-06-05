-- ============================================================
-- 014_picado_attendance.sql
-- Confirmación de asistencia: el jugador anotado puede confirmar
-- (o desconfirmar) que va a ir al partido, identificándose por DNI.
-- ============================================================

-- ── Columna de confirmación en picado_signups ────────────
ALTER TABLE public.picado_signups
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false;

-- ── RPC: confirmar/desconfirmar asistencia por DNI ───────
-- Mismo patrón de identificación que anotarse/bajarse (hash_dni +
-- player_identities). Solo permite a quien está anotado (titular/espera).
DROP FUNCTION IF EXISTS public.picado_confirmar_asistencia(text, uuid, boolean);
CREATE OR REPLACE FUNCTION public.picado_confirmar_asistencia(
  p_dni        text,
  p_match_id   uuid,
  p_confirmado boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni_hash text;
  v_player   players%ROWTYPE;
  v_signup   picado_signups%ROWTYPE;
BEGIN
  -- 1. Hashear y validar DNI
  v_dni_hash := hash_dni(p_dni);
  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI inválido (debe tener 7 a 9 dígitos)');
  END IF;

  -- 2. Identificar jugador
  SELECT p.* INTO v_player
  FROM players p
  INNER JOIN player_identities pi ON pi.player_id = p.id
  WHERE pi.dni_hash = v_dni_hash
    AND p.activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI no reconocido');
  END IF;

  -- 3. Debe estar anotado (no dado de baja)
  SELECT * INTO v_signup
  FROM picado_signups
  WHERE match_id = p_match_id
    AND player_id = v_player.id
    AND estado IN ('titular', 'espera');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No estás anotado en este partido');
  END IF;

  -- 4. Setear confirmación
  UPDATE picado_signups
  SET confirmado = COALESCE(p_confirmado, true)
  WHERE id = v_signup.id;

  RETURN jsonb_build_object(
    'ok',         true,
    'confirmado', COALESCE(p_confirmado, true),
    'player_id',  v_player.id,
    'nombre',     v_player.nombre,
    'message',    CASE WHEN COALESCE(p_confirmado, true)
                       THEN 'Asistencia confirmada'
                       ELSE 'Confirmación cancelada' END
  );
END;
$$;
