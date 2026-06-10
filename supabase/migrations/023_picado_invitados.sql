-- ============================================================
-- 023_picado_invitados.sql
-- Invitados externos: un jugador anotado puede sumar a un amigo/conocido
-- (sin DNI ni registro) para completar la convocatoria. El invitado cuenta
-- para el cupo (titular/espera) y quien lo trajo puede darlo de baja.
-- ============================================================

-- 1. Permitir signups sin jugador registrado + datos del invitado
ALTER TABLE public.picado_signups
  ALTER COLUMN player_id DROP NOT NULL;

ALTER TABLE public.picado_signups
  ADD COLUMN IF NOT EXISTS guest_name text;

ALTER TABLE public.picado_signups
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.players(id) ON DELETE SET NULL;

-- Integridad: cada signup es de un jugador (player_id) o de un invitado
-- (guest_name); nunca ambos vacíos.
ALTER TABLE public.picado_signups
  DROP CONSTRAINT IF EXISTS picado_signups_player_or_guest;
ALTER TABLE public.picado_signups
  ADD CONSTRAINT picado_signups_player_or_guest
  CHECK (player_id IS NOT NULL OR guest_name IS NOT NULL);

-- 2. RPC: agregar invitado (lo agrega un jugador ya anotado)
-- Valida que el anfitrión esté anotado (titular/espera) en un partido abierto.
CREATE OR REPLACE FUNCTION public.picado_agregar_invitado(
  p_match_id       uuid,
  p_host_player_id uuid,
  p_guest_name     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match        picado_matches%ROWTYPE;
  v_host         picado_signups%ROWTYPE;
  v_titulares    integer;
  v_estado_nuevo text;
  v_next_orden   integer;
  v_signup_id    uuid;
  v_name         text;
BEGIN
  v_name := NULLIF(btrim(COALESCE(p_guest_name, '')), '');
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Ingresá el nombre del invitado');
  END IF;

  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;
  IF v_match.estado <> 'abierto' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La inscripción no está abierta');
  END IF;

  -- El anfitrión debe estar anotado en el partido (no dado de baja)
  SELECT * INTO v_host
  FROM picado_signups
  WHERE match_id = p_match_id
    AND player_id = p_host_player_id
    AND estado IN ('titular', 'espera');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Tenés que estar anotado para sumar un invitado');
  END IF;

  -- Titular si hay cupo, sino a la espera (mismo criterio que anotarse)
  SELECT COUNT(*) INTO v_titulares
  FROM picado_signups WHERE match_id = p_match_id AND estado = 'titular';
  v_estado_nuevo := CASE WHEN v_titulares < v_match.cupo_max THEN 'titular' ELSE 'espera' END;

  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next_orden
  FROM picado_signups WHERE match_id = p_match_id;

  INSERT INTO picado_signups (match_id, player_id, estado, orden, guest_name, invited_by)
  VALUES (p_match_id, NULL, v_estado_nuevo, v_next_orden, v_name, p_host_player_id)
  RETURNING id INTO v_signup_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'estado',    v_estado_nuevo,
    'signup_id', v_signup_id::text,
    'message',   CASE v_estado_nuevo
                   WHEN 'titular' THEN 'Invitado anotado como titular'
                   ELSE 'Invitado en la lista de espera'
                 END
  );
END;
$$;

-- 3. RPC: quitar invitado (solo quien lo trajo)
CREATE OR REPLACE FUNCTION public.picado_quitar_invitado(
  p_signup_id      uuid,
  p_host_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup picado_signups%ROWTYPE;
BEGIN
  SELECT * INTO v_signup FROM picado_signups WHERE id = p_signup_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invitado no encontrado');
  END IF;

  IF v_signup.guest_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Ese registro no es un invitado');
  END IF;

  IF v_signup.invited_by IS DISTINCT FROM p_host_player_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Solo quien lo agregó puede darlo de baja');
  END IF;

  -- Marcar baja (dispara el trigger de promoción de la lista de espera)
  UPDATE picado_signups SET estado = 'baja' WHERE id = p_signup_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Invitado dado de baja');
END;
$$;
