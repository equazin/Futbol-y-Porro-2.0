-- ============================================================
-- 003_picado_functions.sql
-- Funciones RPC (SECURITY DEFINER) + trigger de promoción
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- anotarse(p_codigo, p_match_id) → jsonb
-- ──────────────────────────────────────────────────────────
-- Valida código, estado del partido y cupo disponible.
-- Asigna titular si hay lugar, espera si está lleno.
-- Permite re-anotarse después de una baja.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.anotarse(p_codigo text, p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player          picado_players%ROWTYPE;
  v_match           picado_matches%ROWTYPE;
  v_existing        picado_signups%ROWTYPE;
  v_titulares_count integer;
  v_next_orden      integer;
  v_estado_nuevo    text;
BEGIN
  -- 1. Buscar el partido
  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;

  -- 2. Verificar que la inscripción esté abierta
  IF v_match.estado <> 'abierto' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La inscripción no está abierta');
  END IF;

  -- 3. Buscar jugador por código en el mismo grupo (case-insensitive)
  SELECT * INTO v_player
  FROM picado_players
  WHERE upper(trim(codigo)) = upper(trim(p_codigo))
    AND group_id = v_match.group_id
    AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Código incorrecto');
  END IF;

  -- 4. Verificar si ya está anotado
  SELECT * INTO v_existing
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id;

  IF FOUND THEN
    IF v_existing.estado = 'baja' THEN
      -- Fue baja: eliminar para re-anotar como nuevo
      DELETE FROM picado_signups WHERE id = v_existing.id;
    ELSE
      RETURN jsonb_build_object(
        'ok',      false,
        'message', 'Ya estás anotado en este partido',
        'estado',  v_existing.estado,
        'orden',   v_existing.orden,
        'player_id', v_player.id::text,
        'nombre',  COALESCE(v_player.apodo, v_player.nombre)
      );
    END IF;
  END IF;

  -- 5. Contar titulares actuales
  SELECT COUNT(*) INTO v_titulares_count
  FROM picado_signups
  WHERE match_id = p_match_id AND estado = 'titular';

  -- 6. Titular o espera
  v_estado_nuevo := CASE WHEN v_titulares_count < v_match.cupo_max THEN 'titular' ELSE 'espera' END;

  -- 7. Siguiente orden (FIFO global)
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next_orden
  FROM picado_signups
  WHERE match_id = p_match_id;

  -- 8. Insertar
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
-- bajarse(p_codigo, p_match_id) → jsonb
-- ──────────────────────────────────────────────────────────
-- Pasa la inscripción activa a 'baja'.
-- El trigger picado_trg_promote_from_espera se encarga
-- de subir al primero de la espera si el que se baja era titular.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bajarse(p_codigo text, p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player picado_players%ROWTYPE;
  v_match  picado_matches%ROWTYPE;
  v_signup picado_signups%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;

  SELECT * INTO v_player
  FROM picado_players
  WHERE upper(trim(codigo)) = upper(trim(p_codigo))
    AND group_id = v_match.group_id
    AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Código incorrecto');
  END IF;

  SELECT * INTO v_signup
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id AND estado <> 'baja';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No estás anotado en este partido');
  END IF;

  -- Actualizar a baja — el trigger promueve al primero de espera si era titular
  UPDATE picado_signups SET estado = 'baja' WHERE id = v_signup.id;

  RETURN jsonb_build_object(
    'ok',      true,
    'message', 'Te bajaste del partido'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- Trigger: promover primer espera cuando un titular se baja
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.picado_fn_promote_from_espera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match           picado_matches%ROWTYPE;
  v_titulares_count integer;
  v_next_espera     picado_signups%ROWTYPE;
BEGIN
  -- Solo actuar cuando un titular pasa a baja
  IF OLD.estado = 'titular' AND NEW.estado = 'baja' THEN
    SELECT * INTO v_match FROM picado_matches WHERE id = NEW.match_id;

    SELECT COUNT(*) INTO v_titulares_count
    FROM picado_signups
    WHERE match_id = NEW.match_id AND estado = 'titular';

    -- Si hay lugar libre, promover al primero de la espera
    IF v_titulares_count < v_match.cupo_max THEN
      SELECT * INTO v_next_espera
      FROM picado_signups
      WHERE match_id = NEW.match_id AND estado = 'espera'
      ORDER BY orden ASC
      LIMIT 1;

      IF FOUND THEN
        UPDATE picado_signups SET estado = 'titular' WHERE id = v_next_espera.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger (DROP IF EXISTS para idempotencia)
DROP TRIGGER IF EXISTS picado_trg_promote_from_espera ON public.picado_signups;
CREATE TRIGGER picado_trg_promote_from_espera
  AFTER UPDATE ON public.picado_signups
  FOR EACH ROW EXECUTE FUNCTION public.picado_fn_promote_from_espera();

-- ──────────────────────────────────────────────────────────
-- Seed: grupo y jugadores de prueba
-- (Ejecutar solo si no existe ya el grupo)
-- ──────────────────────────────────────────────────────────
INSERT INTO public.picado_groups (id, nombre, slug, descripcion)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Futbol y Porro FC',
  'fyp-fc',
  'El picado de los miércoles. Desde 2018.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.picado_players (id, group_id, nombre, apodo, posicion, nivel, codigo) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Nicolás Benítez',  'Nico',     'mediocampista', 1350, 'NICO'),
  ('a0000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'Martín López',     'Lopito',   'delantero',     1500, 'MART'),
  ('a0000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'Diego Fernández',  'El Diego', 'arquero',       1400, 'DIEG'),
  ('a0000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'Carlos Ruiz',      'Carlitos', 'defensor',      1200, 'CARL'),
  ('a0000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'Sebastián Torres', 'Sebas',    'mediocampista', 1450, 'SEBA'),
  ('a0000001-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000001', 'Andrés Moreno',    'Moro',     'delantero',     1300, 'ANDI'),
  ('a0000001-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000001', 'Pablo García',     'Garcha',   'defensor',      1150, 'PABL'),
  ('a0000001-0000-0000-0000-000000000008', 'a1b2c3d4-0000-0000-0000-000000000001', 'Facundo Díaz',     'El Facu',  'polifuncional', 1250, 'FACU'),
  ('a0000001-0000-0000-0000-000000000009', 'a1b2c3d4-0000-0000-0000-000000000001', 'Lucas Romero',     'Luky',     'arquero',       1100, 'LUCA'),
  ('a0000001-0000-0000-0000-00000000000a', 'a1b2c3d4-0000-0000-0000-000000000001', 'Ezequiel Vargas',  'El Varga', 'mediocampista', 1380, 'EZEQ'),
  ('a0000001-0000-0000-0000-00000000000b', 'a1b2c3d4-0000-0000-0000-000000000001', 'Matías Herrera',   'Mati',     'delantero',     1600, 'MATI'),
  ('a0000001-0000-0000-0000-00000000000c', 'a1b2c3d4-0000-0000-0000-000000000001', 'Rodrigo Sosa',     'Rodri',    'defensor',      1050, 'RODR'),
  ('a0000001-0000-0000-0000-00000000000d', 'a1b2c3d4-0000-0000-0000-000000000001', 'Tomás Acosta',     'Tomy',     'mediocampista', 1320, 'TOMY'),
  ('a0000001-0000-0000-0000-00000000000e', 'a1b2c3d4-0000-0000-0000-000000000001', 'Cristian Flores',  'Cris',     'polifuncional', 1180, 'CRIS'),
  ('a0000001-0000-0000-0000-00000000000f', 'a1b2c3d4-0000-0000-0000-000000000001', 'Hernán Aguirre',   'El Toro',  'defensor',      1420, 'HERN')
ON CONFLICT DO NOTHING;

-- Partido de prueba abierto (próximo miércoles)
INSERT INTO public.picado_matches (id, group_id, fecha, hora, sede, formato, cupo_max, estado, inscripcion_abre, inscripcion_cierra)
VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  (CURRENT_DATE + ((3 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7 + 7))::date,
  '20:00:00', 'Cancha de Porro — Lugano', '7v7', 14, 'abierto',
  now() - interval '1 day', now() + interval '6 days'
)
ON CONFLICT DO NOTHING;
