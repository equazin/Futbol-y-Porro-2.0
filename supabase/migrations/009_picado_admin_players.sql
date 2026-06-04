-- ============================================================
-- 009_picado_admin_players.sql
-- Operaciones admin del plantel para Picado.
-- Usa SECURITY DEFINER porque el admin del modulo se maneja desde la app
-- con PIN local y las tablas pueden tener RLS activo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.picado_admin_set_player_dni(
  p_player_id uuid,
  p_dni text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
BEGIN
  v_normalized := normalize_dni(COALESCE(p_dni, ''));

  IF v_normalized = '' THEN
    DELETE FROM public.player_identities WHERE player_id = p_player_id;
    RETURN;
  END IF;

  IF length(v_normalized) < 7 OR length(v_normalized) > 9 THEN
    RAISE EXCEPTION 'DNI invalido';
  END IF;

  INSERT INTO public.player_identities (player_id, dni_hash, dni_last4, updated_at)
  VALUES (
    p_player_id,
    hash_dni(v_normalized),
    right(v_normalized, 4),
    now()
  )
  ON CONFLICT (player_id) DO UPDATE
    SET dni_hash = EXCLUDED.dni_hash,
        dni_last4 = EXCLUDED.dni_last4,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.picado_admin_create_player(
  p_nombre text,
  p_apodo text,
  p_posicion text,
  p_elo integer,
  p_foto_url text,
  p_dni text
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.players%ROWTYPE;
BEGIN
  IF trim(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;

  INSERT INTO public.players (
    nombre,
    apodo,
    posicion,
    elo,
    foto_url,
    activo,
    tipo
  )
  VALUES (
    trim(p_nombre),
    NULLIF(trim(COALESCE(p_apodo, '')), ''),
    NULLIF(trim(COALESCE(p_posicion, '')), ''),
    COALESCE(p_elo, 1000),
    NULLIF(trim(COALESCE(p_foto_url, '')), ''),
    true,
    'titular'
  )
  RETURNING * INTO v_player;

  IF normalize_dni(COALESCE(p_dni, '')) <> '' THEN
    PERFORM public.picado_admin_set_player_dni(v_player.id, p_dni);
  END IF;

  RETURN v_player;
END;
$$;

CREATE OR REPLACE FUNCTION public.picado_admin_update_player(
  p_id uuid,
  p_nombre text,
  p_apodo text,
  p_posicion text,
  p_elo integer,
  p_foto_url text,
  p_dni text,
  p_update_dni boolean
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.players%ROWTYPE;
BEGIN
  UPDATE public.players
  SET nombre = COALESCE(NULLIF(trim(COALESCE(p_nombre, '')), ''), nombre),
      apodo = COALESCE(NULLIF(trim(COALESCE(p_apodo, '')), ''), apodo),
      posicion = COALESCE(NULLIF(trim(COALESCE(p_posicion, '')), ''), posicion),
      elo = COALESCE(p_elo, elo),
      foto_url = COALESCE(NULLIF(trim(COALESCE(p_foto_url, '')), ''), foto_url),
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

CREATE OR REPLACE FUNCTION public.picado_admin_delete_player(p_id uuid)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.players%ROWTYPE;
BEGIN
  UPDATE public.players
  SET activo = false,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_player;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jugador no encontrado';
  END IF;

  RETURN v_player;
END;
$$;
