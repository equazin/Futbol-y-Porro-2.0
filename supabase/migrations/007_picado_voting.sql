-- ============================================================
-- 007_picado_voting.sql
-- Registra los votos de MVP y Gol de la Fecha de cada jugador.
-- Almacena los votos en el campo 'notas' del partido en formato JSON.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_voto(
  p_match_id uuid,
  p_dni text,
  p_mvp_vote uuid,
  p_gol_vote uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni_hash      text;
  v_player        players%ROWTYPE;
  v_match         picado_matches%ROWTYPE;
  v_signup        picado_signups%ROWTYPE;
  v_notas_json    jsonb;
  v_votes         jsonb;
  v_new_vote      jsonb;
  v_index         integer;
BEGIN
  -- 1. Hashear y validar DNI
  v_dni_hash := hash_dni(p_dni);
  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI inválido');
  END IF;

  -- 2. Buscar jugador por DNI
  SELECT p.* INTO v_player
  FROM players p
  INNER JOIN player_identities pi ON pi.player_id = p.id
  WHERE pi.dni_hash = v_dni_hash AND p.activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI no reconocido');
  END IF;

  -- 3. Buscar partido
  SELECT * INTO v_match FROM picado_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido no encontrado');
  END IF;

  -- 4. Verificar estado del partido (debe ser jugado)
  IF v_match.estado <> 'jugado' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La votación no está abierta para este partido');
  END IF;

  -- 5. Verificar que el jugador participó en el partido (estado diferente de baja)
  SELECT * INTO v_signup
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id AND estado <> 'baja';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No figuras en la planilla de juego de este partido');
  END IF;

  -- 6. Obtener votos actuales desde las notas (o inicializar)
  v_notas_json := COALESCE(v_match.notas::jsonb, '{}'::jsonb);
  v_votes := COALESCE(v_notas_json->'votes', '[]'::jsonb);

  -- 7. Crear el voto nuevo
  v_new_vote := jsonb_build_object(
    'voter_id', v_player.id::text,
    'mvp_vote', p_mvp_vote::text,
    'gol_vote', p_gol_vote::text
  );

  -- 8. Si ya votó, actualizar su voto; sino, agregarlo
  v_index := -1;
  FOR i IN 0..jsonb_array_length(v_votes) - 1 LOOP
    IF (v_votes->i->>'voter_id') = v_player.id::text THEN
      v_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_index >= 0 THEN
    v_votes := jsonb_set(v_votes, array[v_index::text], v_new_vote);
  ELSE
    v_votes := v_votes || jsonb_build_array(v_new_vote);
  END IF;

  -- 9. Guardar los votos actualizados en las notas
  v_notas_json := jsonb_set(v_notas_json, '{votes}', v_votes);

  UPDATE picado_matches
  SET notas = v_notas_json::text
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', '¡Voto registrado con éxito!',
    'player_id', v_player.id::text,
    'nombre', COALESCE(v_player.apodo, v_player.nombre)
  );
END;
$$;
