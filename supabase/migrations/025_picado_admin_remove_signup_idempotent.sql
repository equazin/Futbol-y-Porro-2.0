-- ============================================================
-- 025_picado_admin_remove_signup_idempotent.sql
-- Hace idempotente la baja manual: si el participante ya esta en baja,
-- igual limpia el JSON de equipos guardado en notas y no responde 400.
-- ============================================================

CREATE OR REPLACE FUNCTION public.picado_admin_remove_signup(
  p_match_id uuid,
  p_participant_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup public.picado_signups%ROWTYPE;
  v_signup_id uuid;
  v_participant_id text;
  v_lookup_id text;
  v_notas jsonb;
  v_team_a jsonb;
  v_team_b jsonb;
  v_votes jsonb;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Partido requerido');
  END IF;

  v_lookup_id := NULLIF(btrim(COALESCE(p_participant_id, '')), '');
  IF v_lookup_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Participante requerido');
  END IF;

  IF left(v_lookup_id, 6) = 'guest:' THEN
    BEGIN
      v_signup_id := substring(v_lookup_id from 7)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Invitado invalido');
    END;

    SELECT * INTO v_signup
    FROM public.picado_signups
    WHERE id = v_signup_id
      AND match_id = p_match_id;

    v_participant_id := v_lookup_id;
  ELSE
    BEGIN
      SELECT * INTO v_signup
      FROM public.picado_signups
      WHERE match_id = p_match_id
        AND player_id = v_lookup_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Jugador invalido');
    END;

    v_participant_id := v_lookup_id;
  END IF;

  IF v_signup.id IS NOT NULL AND v_signup.estado <> 'baja' THEN
    UPDATE public.picado_signups
    SET estado = 'baja'
    WHERE id = v_signup.id;
  END IF;

  BEGIN
    SELECT notas::jsonb INTO v_notas
    FROM public.picado_matches
    WHERE id = p_match_id
      AND notas IS NOT NULL
      AND btrim(notas) <> '';
  EXCEPTION WHEN others THEN
    v_notas := NULL;
  END;

  IF v_notas IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(item.value)), '[]'::jsonb)
    INTO v_team_a
    FROM jsonb_array_elements_text(COALESCE(v_notas->'teamA', '[]'::jsonb)) AS item(value)
    WHERE item.value <> v_participant_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(item.value)), '[]'::jsonb)
    INTO v_team_b
    FROM jsonb_array_elements_text(COALESCE(v_notas->'teamB', '[]'::jsonb)) AS item(value)
    WHERE item.value <> v_participant_id;

    SELECT COALESCE(jsonb_agg(vote.value), '[]'::jsonb)
    INTO v_votes
    FROM jsonb_array_elements(COALESCE(v_notas->'votes', '[]'::jsonb)) AS vote(value)
    WHERE vote.value->>'voter_id' <> v_participant_id
      AND vote.value->>'mvp_vote' <> v_participant_id
      AND vote.value->>'gol_vote' <> v_participant_id;

    v_notas := jsonb_set(v_notas, '{teamA}', v_team_a, true);
    v_notas := jsonb_set(v_notas, '{teamB}', v_team_b, true);
    v_notas := jsonb_set(v_notas, '{stats}', COALESCE(v_notas->'stats', '{}'::jsonb) - v_participant_id, true);
    v_notas := jsonb_set(v_notas, '{votes}', v_votes, true);

    IF v_notas->>'mvpResult' = v_participant_id THEN
      v_notas := v_notas - 'mvpResult';
    END IF;
    IF v_notas->>'golResult' = v_participant_id THEN
      v_notas := v_notas - 'golResult';
    END IF;

    UPDATE public.picado_matches
    SET notas = v_notas::text
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'signup_id', CASE WHEN v_signup.id IS NULL THEN NULL ELSE v_signup.id::text END,
    'participant_id', v_participant_id,
    'message', CASE
      WHEN v_signup.id IS NULL THEN 'Participante removido de la planilla'
      WHEN v_signup.estado = 'baja' THEN 'El participante ya estaba dado de baja; planilla limpiada'
      ELSE 'Baja registrada'
    END
  );
END;
$$;

-- Fuerza a PostgREST/Supabase REST a refrescar la cache de funciones.
NOTIFY pgrst, 'reload schema';
