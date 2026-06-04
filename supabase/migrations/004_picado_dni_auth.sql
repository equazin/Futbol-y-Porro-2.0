-- ============================================================
-- 004_picado_dni_auth.sql
-- Vincula picado_signups a la tabla 'players' existente y
-- reemplaza el sistema de código PIN por autenticación con DNI,
-- reutilizando las funciones hash_dni() / normalize_dni() y
-- la tabla player_identities del sistema de votación.
-- ============================================================

-- 1. Limpiar datos de prueba de la migración 003 (jugadores ficticios)
--    antes de cambiar el FK, para evitar violaciones de integridad
DELETE FROM public.picado_signups
WHERE player_id IN (
  SELECT id FROM public.picado_players
);

-- 2. Reconectar FK de picado_signups → players (tabla real)
ALTER TABLE IF EXISTS public.picado_signups
  DROP CONSTRAINT IF EXISTS picado_signups_player_id_fkey;

ALTER TABLE IF EXISTS public.picado_signups
  ADD CONSTRAINT picado_signups_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- 2. Eliminar la tabla separada de jugadores (ya no necesaria)
DROP TABLE IF EXISTS public.picado_players CASCADE;

-- ──────────────────────────────────────────────────────────
-- anotarse(p_dni, p_match_id) → jsonb
-- Usa hash_dni() + player_identities para identificar al jugador
-- ──────────────────────────────────────────────────────────
-- DROP previo necesario porque 003 creó anotarse(p_codigo, ...) y
-- PostgreSQL no permite cambiar nombres de parámetros con CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.anotarse(text, uuid);
CREATE OR REPLACE FUNCTION public.anotarse(p_dni text, p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni_hash    text;
  v_player      players%ROWTYPE;
  v_match       picado_matches%ROWTYPE;
  v_existing    picado_signups%ROWTYPE;
  v_titulares   integer;
  v_next_orden  integer;
  v_estado_nuevo text;
BEGIN
  -- 1. Hashear y validar el DNI
  v_dni_hash := hash_dni(p_dni);
  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI inválido (debe tener 7 a 9 dígitos)');
  END IF;

  -- 2. Buscar jugador via player_identities
  SELECT p.* INTO v_player
  FROM players p
  INNER JOIN player_identities pi ON pi.player_id = p.id
  WHERE pi.dni_hash = v_dni_hash
    AND p.activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI no reconocido');
  END IF;

  -- 3. Buscar el partido
  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;

  -- 4. Verificar que la inscripción esté abierta
  IF v_match.estado <> 'abierto' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La inscripción no está abierta');
  END IF;

  -- 5. ¿Ya está anotado?
  SELECT * INTO v_existing
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id;

  IF FOUND THEN
    IF v_existing.estado = 'baja' THEN
      -- Re-anotarse después de una baja: eliminar y reanotar
      DELETE FROM picado_signups WHERE id = v_existing.id;
    ELSE
      RETURN jsonb_build_object(
        'ok',       false,
        'message',  'Ya estás anotado en este partido',
        'estado',   v_existing.estado,
        'orden',    v_existing.orden,
        'player_id', v_player.id::text,
        'nombre',   COALESCE(v_player.apodo, v_player.nombre)
      );
    END IF;
  END IF;

  -- 6. Contar titulares actuales
  SELECT COUNT(*) INTO v_titulares
  FROM picado_signups
  WHERE match_id = p_match_id AND estado = 'titular';

  -- 7. Titular o lista de espera
  v_estado_nuevo := CASE WHEN v_titulares < v_match.cupo_max THEN 'titular' ELSE 'espera' END;

  -- 8. Siguiente orden (FIFO global)
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next_orden
  FROM picado_signups WHERE match_id = p_match_id;

  -- 9. Insertar inscripción
  INSERT INTO picado_signups (match_id, player_id, estado, orden)
  VALUES (p_match_id, v_player.id, v_estado_nuevo, v_next_orden);

  RETURN jsonb_build_object(
    'ok',       true,
    'estado',   v_estado_nuevo,
    'orden',    v_next_orden,
    'player_id', v_player.id::text,
    'nombre',   COALESCE(v_player.apodo, v_player.nombre),
    'message',  CASE v_estado_nuevo
                  WHEN 'titular' THEN '¡Estás anotado!'
                  ELSE 'Entraste a la lista de espera'
                END
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- bajarse(p_dni, p_match_id) → jsonb
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.bajarse(text, uuid);
CREATE OR REPLACE FUNCTION public.bajarse(p_dni text, p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni_hash  text;
  v_player    players%ROWTYPE;
  v_match     picado_matches%ROWTYPE;
  v_signup    picado_signups%ROWTYPE;
BEGIN
  v_dni_hash := hash_dni(p_dni);
  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI inválido');
  END IF;

  SELECT p.* INTO v_player
  FROM players p
  INNER JOIN player_identities pi ON pi.player_id = p.id
  WHERE pi.dni_hash = v_dni_hash AND p.activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI no reconocido');
  END IF;

  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;

  SELECT * INTO v_signup
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id AND estado <> 'baja';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No estás anotado en este partido');
  END IF;

  -- El trigger picado_trg_promote_from_espera sube al primero de espera
  UPDATE picado_signups SET estado = 'baja' WHERE id = v_signup.id;

  RETURN jsonb_build_object(
    'ok',     true,
    'message','Te bajaste del partido'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- Actualizar trigger: ahora busca jugador en 'players'
-- (el trigger referencia picado_matches, no cambia la lógica)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.picado_fn_promote_from_espera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match       picado_matches%ROWTYPE;
  v_titulares   integer;
  v_next_espera picado_signups%ROWTYPE;
BEGIN
  IF OLD.estado = 'titular' AND NEW.estado = 'baja' THEN
    SELECT * INTO v_match FROM picado_matches WHERE id = NEW.match_id;

    SELECT COUNT(*) INTO v_titulares
    FROM picado_signups
    WHERE match_id = NEW.match_id AND estado = 'titular';

    IF v_titulares < v_match.cupo_max THEN
      SELECT * INTO v_next_espera
      FROM picado_signups
      WHERE match_id = NEW.match_id AND estado = 'espera'
      ORDER BY orden ASC LIMIT 1;

      IF FOUND THEN
        UPDATE picado_signups SET estado = 'titular' WHERE id = v_next_espera.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recrear trigger (ya existe por 003, pero por idempotencia)
DROP TRIGGER IF EXISTS picado_trg_promote_from_espera ON public.picado_signups;
CREATE TRIGGER picado_trg_promote_from_espera
  AFTER UPDATE ON public.picado_signups
  FOR EACH ROW EXECUTE FUNCTION public.picado_fn_promote_from_espera();

-- ──────────────────────────────────────────────────────────
-- RLS: permitir que anon lea players (join desde signups)
-- Solo si no existe ya una política de lectura pública
-- ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players' AND policyname = 'picado_players_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY picado_players_public_read ON public.players FOR SELECT USING (activo = true)';
  END IF;
END;
$$;
