-- ============================================================
-- 024_picado_admin_remove_signup.sql
-- Baja manual admin de participantes.
-- Usa SECURITY DEFINER porque picado_signups tiene RLS y la app administra
-- permisos con PIN/DNI. Ademas limpia el JSON de equipos guardado en notas.
-- ============================================================

DROP FUNCTION IF EXISTS public.picado_admin_remove_signup(uuid, text);

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
  v_notas jsonb;
  v_team_a jsonb;
  v_team_b jsonb;
  v_votes jsonb;
BEGIN
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Partido requerido';
  END IF;

  v_participant_id := NULLIF(btrim(COALESCE(p_participant_id, '')), '');
  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'Participante requerido';
  END IF;

  IF left(v_participant_id, 6) = 'guest:' THEN
    BEGIN
      v_signup_id := substring(v_participant_id from 7)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invitado invalido';
    END;

    SELECT * INTO v_signup
    FROM public.picado_signups
    WHERE id = v_signup_id
      AND match_id = p_match_id
      AND estado IN ('titular', 'espera');

    v_participant_id := 'guest:' || v_signup.id::text;
  ELSE
    BEGIN
      SELECT * INTO v_signup
      FROM public.picado_signups
      WHERE match_id = p_match_id
        AND player_id = v_participant_id::uuid
        AND estado IN ('titular', 'espera');
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Jugador invalido';
    END;

    v_participant_id := v_signup.player_id::text;
  END IF;

  IF NOT FOUND OR v_signup.id IS NULL THEN
    RAISE EXCEPTION 'Inscripcion no encontrada o ya dada de baja';
  END IF;

  UPDATE public.picado_signups
  SET estado = 'baja'
  WHERE id = v_signup.id;

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
    'signup_id', v_signup.id::text,
    'participant_id', v_participant_id,
    'message', 'Baja registrada'
  );
END;
$$;
