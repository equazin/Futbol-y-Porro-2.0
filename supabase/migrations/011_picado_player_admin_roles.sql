-- ============================================================
-- 011_picado_player_admin_roles.sql
-- Roles admin por jugador para el modulo Picado.
-- El PIN 1984 sigue siendo el acceso principal desde la app.
-- ============================================================

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS picado_admin_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_picado_admin_role_check'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_picado_admin_role_check
      CHECK (picado_admin_role IS NULL OR picado_admin_role IN ('general', 'equipos'));
  END IF;
END;
$$;

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

DROP FUNCTION IF EXISTS public.picado_admin_create_player(text, text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.picado_admin_create_player(
  p_nombre text,
  p_apodo text,
  p_posicion text,
  p_elo integer,
  p_foto_url text,
  p_dni text,
  p_admin_role text DEFAULT NULL
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.players%ROWTYPE;
  v_admin_role text;
BEGIN
  IF trim(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;

  v_admin_role := NULLIF(trim(COALESCE(p_admin_role, '')), '');
  IF v_admin_role IS NOT NULL AND v_admin_role NOT IN ('general', 'equipos') THEN
    RAISE EXCEPTION 'Rol admin invalido';
  END IF;

  INSERT INTO public.players (
    nombre,
    apodo,
    posicion,
    elo,
    foto_url,
    activo,
    tipo,
    picado_admin_role
  )
  VALUES (
    trim(p_nombre),
    NULLIF(trim(COALESCE(p_apodo, '')), ''),
    NULLIF(trim(COALESCE(p_posicion, '')), ''),
    COALESCE(p_elo, 1000),
    NULLIF(trim(COALESCE(p_foto_url, '')), ''),
    true,
    'titular',
    v_admin_role
  )
  RETURNING * INTO v_player;

  IF normalize_dni(COALESCE(p_dni, '')) <> '' THEN
    PERFORM public.picado_admin_set_player_dni(v_player.id, p_dni);
  END IF;

  RETURN v_player;
END;
$$;

DROP FUNCTION IF EXISTS public.picado_admin_update_player(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  boolean
);

CREATE OR REPLACE FUNCTION public.picado_admin_update_player(
  p_id uuid,
  p_nombre text,
  p_apodo text,
  p_posicion text,
  p_elo integer,
  p_foto_url text,
  p_dni text,
  p_update_dni boolean,
  p_admin_role text DEFAULT NULL,
  p_update_admin_role boolean DEFAULT false
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.players%ROWTYPE;
  v_admin_role text;
BEGIN
  IF COALESCE(p_update_admin_role, false) THEN
    v_admin_role := NULLIF(trim(COALESCE(p_admin_role, '')), '');
    IF v_admin_role IS NOT NULL AND v_admin_role NOT IN ('general', 'equipos') THEN
      RAISE EXCEPTION 'Rol admin invalido';
    END IF;
  END IF;

  UPDATE public.players
  SET nombre = COALESCE(NULLIF(trim(COALESCE(p_nombre, '')), ''), nombre),
      apodo = COALESCE(NULLIF(trim(COALESCE(p_apodo, '')), ''), apodo),
      posicion = COALESCE(NULLIF(trim(COALESCE(p_posicion, '')), ''), posicion),
      elo = COALESCE(p_elo, elo),
      foto_url = COALESCE(NULLIF(trim(COALESCE(p_foto_url, '')), ''), foto_url),
      picado_admin_role = CASE
        WHEN COALESCE(p_update_admin_role, false) THEN v_admin_role
        ELSE picado_admin_role
      END,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_player;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jugador no encontrado';
  END IF;

  IF COALESCE(p_update_dni, false) THEN
    PERFORM public.picado_admin_set_player_dni(p_id, p_dni);
  END IF;

  RETURN v_player;
END;
$$;
