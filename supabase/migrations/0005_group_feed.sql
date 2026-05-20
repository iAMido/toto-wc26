-- =============================================================
-- Migration 0005: get_match_predictions_for_group RPC
-- =============================================================
-- Returns every group member's prediction data for a specific
-- match with delayed-reveal logic enforced server-side:
--
--   Pre-kickoff  → only `has_predicted` is true/false;
--                   scores/joker/advancer visible only for the
--                   calling user's own row.
--   Post-kickoff → full reveal (home, away, joker_used,
--                   advancer_team_id, points) for all members.
--
-- SECURITY DEFINER so the function can peek at predictions
-- regardless of per-row RLS on the predictions table.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_match_predictions_for_group(
  p_match_id uuid,
  p_group_id uuid
)
RETURNS TABLE(
  user_id          uuid,
  display_name     text,
  has_predicted    boolean,
  home             integer,
  away             integer,
  joker_used       boolean,
  advancer_team_id text,
  points           integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kickoff  timestamptz;
  v_revealed boolean;
BEGIN
  SELECT m.kickoff_at INTO v_kickoff
    FROM matches m
   WHERE m.id = p_match_id;

  v_revealed := (now() >= v_kickoff);

  RETURN QUERY
  SELECT
    gm.user_id,
    u.display_name,
    (p.id IS NOT NULL)                                                         AS has_predicted,
    CASE WHEN v_revealed OR gm.user_id = auth.uid() THEN p.home          ELSE NULL END AS home,
    CASE WHEN v_revealed OR gm.user_id = auth.uid() THEN p.away          ELSE NULL END AS away,
    CASE WHEN v_revealed OR gm.user_id = auth.uid() THEN p.joker_used    ELSE NULL END AS joker_used,
    CASE WHEN v_revealed OR gm.user_id = auth.uid() THEN p.advancer_team_id ELSE NULL END AS advancer_team_id,
    CASE WHEN v_revealed                             THEN p.points        ELSE NULL END AS points
  FROM group_members gm
  JOIN users u ON u.id = gm.user_id
  LEFT JOIN predictions p
    ON  p.user_id  = gm.user_id
    AND p.match_id = p_match_id
  WHERE gm.group_id = p_group_id
  ORDER BY u.display_name NULLS LAST;
END;
$$;
