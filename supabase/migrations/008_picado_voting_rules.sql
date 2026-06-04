-- ============================================================
-- 008_picado_voting_rules.sql
-- Refuerza las reglas de votacion:
-- - solo titulares pueden votar y ser votados
-- - no se permite autovoto
-- - el MVP solo puede pertenecer al equipo ganador
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
  v_score_a       integer;
  v_score_b       integer;
  v_winner_team   jsonb;
BEGIN
  v_dni_hash := hash_dni(p_dni);
  IF v_dni_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'DNI invalido');
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

  IF v_match.estado <> 'jugado' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'La votacion no esta abierta para este partido');
  END IF;

  SELECT * INTO v_signup
  FROM picado_signups
  WHERE match_id = p_match_id AND player_id = v_player.id AND estado = 'titular';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No figuras como titular en la planilla de juego de este partido');
  END IF;

  IF p_mvp_vote = v_player.id OR p_gol_vote = v_player.id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No podes votarte a vos mismo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM picado_signups
    WHERE match_id = p_match_id AND player_id = p_mvp_vote AND estado = 'titular'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'El candidato a MVP no participo como titular');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM picado_signups
    WHERE match_id = p_match_id AND player_id = p_gol_vote AND estado = 'titular'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'El candidato a Gol de la Fecha no participo como titular');
  END IF;

  v_notas_json := COALESCE(v_match.notas::jsonb, '{}'::jsonb);
  v_score_a := COALESCE((v_notas_json->>'scoreA')::integer, 0);
  v_score_b := COALESCE((v_notas_json->>'scoreB')::integer, 0);

  IF v_score_a = v_score_b THEN
    RETURN jsonb_build_object('ok', false, 'message', 'El MVP requiere un equipo ganador cargado');
  END IF;

  v_winner_team := CASE
    WHEN v_score_a > v_score_b THEN COALESCE(v_notas_json->'teamA', '[]'::jsonb)
    ELSE COALESCE(v_notas_json->'teamB', '[]'::jsonb)
  END;

  IF NOT (v_winner_team ? p_mvp_vote::text) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'El MVP solo puede ser del equipo ganador');
  END IF;

  v_votes := COALESCE(v_notas_json->'votes', '[]'::jsonb);
  v_new_vote := jsonb_build_object(
    'voter_id', v_player.id::text,
    'mvp_vote', p_mvp_vote::text,
    'gol_vote', p_gol_vote::text
  );

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

  v_notas_json := jsonb_set(v_notas_json, '{votes}', v_votes);

  UPDATE picado_matches
  SET notas = v_notas_json::text
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Voto registrado con exito',
    'player_id', v_player.id::text,
    'nombre', COALESCE(v_player.apodo, v_player.nombre)
  );
END;
$$;
