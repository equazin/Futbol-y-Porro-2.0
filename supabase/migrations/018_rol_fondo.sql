-- ============================================================
-- 018_rol_fondo.sql
-- Nuevo rol de admin acotado: 'fondo' (solo edita el Fondo Común),
-- análogo a 'equipos' (solo arma equipos). El admin general puede
-- asignarlo a un jugador.
-- Replica EXACTO las RPCs de la migración 011 y solo agrega 'fondo'
-- a las listas IN (...) y al CHECK de la columna.
-- ============================================================

-- 1. Constraint de la columna picado_admin_role
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_picado_admin_role_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_picado_admin_role_check
  CHECK (picado_admin_role IS NULL OR picado_admin_role IN ('general', 'equipos', 'fondo'));

-- 2. RPC create_player (idéntica a 011, +'fondo')
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
  IF v_admin_role IS NOT NULL AND v_admin_role NOT IN ('general', 'equipos', 'fondo') THEN
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

-- 3. RPC update_player (idéntica a 011, +'fondo')
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
    IF v_admin_role IS NOT NULL AND v_admin_role NOT IN ('general', 'equipos', 'fondo') THEN
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
