-- ============================================================
-- 022_picado_refresh_admin_identity.sql
-- Asegura que el acceso admin por DNI reciba el rol actualizado.
-- ============================================================

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS picado_admin_role text;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_picado_admin_role_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_picado_admin_role_check
  CHECK (picado_admin_role IS NULL OR picado_admin_role IN ('general', 'equipos', 'fondo'));

CREATE OR REPLACE FUNCTION public.picado_identificar_jugador(p_dni text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni_hash text;
  v_player public.players%ROWTYPE;
BEGIN
  v_dni_hash := hash_dni(p_dni);

  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'DNI invalido (debe tener 7 a 9 digitos)'
    );
  END IF;

  SELECT p.* INTO v_player
  FROM public.players p
  INNER JOIN public.player_identities pi ON pi.player_id = p.id
  WHERE pi.dni_hash = v_dni_hash
    AND p.activo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'DNI no reconocido'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Jugador verificado',
    'player_id', v_player.id::text,
    'nombre', v_player.nombre,
    'apodo', v_player.apodo,
    'posicion', v_player.posicion,
    'foto_url', v_player.foto_url,
    'elo', COALESCE(v_player.elo, 1000),
    'admin_role', v_player.picado_admin_role
  );
END;
$$;
