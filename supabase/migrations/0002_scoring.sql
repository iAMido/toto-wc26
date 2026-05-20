-- toto-wc26 / migration 0002
-- Scoring engine: score_match() function, trigger, leaderboard view.
--
-- Scoring ladder (per prediction):
--   +5  exact score  (home == actual_home AND away == actual_away)
--   +3  goal-difference match  ((home-away) == (actual_home-actual_away))
--   +1  outcome match  (1/X/2 matches)
--    0  otherwise
--
-- Joker: if joker_used = true, multiply base score by 2.
--
-- Advancer bonus (knockout PEN only):
--   +2  if prediction.advancer_team_id == matches.advancer_team_id
--   Added AFTER the joker multiplier — joker does NOT double this bonus.
--
-- Knockout matches (R32, R16, QF, SF, 3RD, FINAL) only score when
-- status reaches AET or PEN — NOT at FT (which means 90-min draw,
-- extra time still pending).
-- Group-stage matches score at FT.

-- ─────────────────────────────────────────────────────────────────────
-- 1. score_match(match_id uuid)
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.score_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match    record;
  v_pred     record;
  v_base     int;
  v_total    int;
  v_actual_outcome int;   -- 1 = home win, 0 = draw, -1 = away win
  v_pred_outcome   int;
begin
  -- Fetch the match.
  select * into v_match from public.matches where id = p_match_id;

  -- Guard: only score if we have final 120-min scores.
  if v_match.home_score_120 is null or v_match.away_score_120 is null then
    return;
  end if;

  -- Compute actual outcome sign.
  v_actual_outcome := sign(v_match.home_score_120 - v_match.away_score_120);

  -- Loop over every prediction for this match.
  for v_pred in
    select * from public.predictions where match_id = p_match_id
  loop
    -- 1. Score ladder.
    if v_pred.home = v_match.home_score_120
       and v_pred.away = v_match.away_score_120 then
      v_base := 5;   -- exact score
    elsif (v_pred.home - v_pred.away) = (v_match.home_score_120 - v_match.away_score_120) then
      v_base := 3;   -- goal difference
    else
      v_pred_outcome := sign(v_pred.home - v_pred.away);
      if v_pred_outcome = v_actual_outcome then
        v_base := 1; -- correct outcome (1/X/2)
      else
        v_base := 0;
      end if;
    end if;

    -- 2. Joker multiplier.
    if v_pred.joker_used then
      v_base := v_base * 2;
    end if;

    -- 3. Advancer bonus (knockout decided by penalties only).
    v_total := v_base;
    if v_match.status = 'PEN'
       and v_pred.advancer_team_id is not null
       and v_match.advancer_team_id is not null
       and v_pred.advancer_team_id = v_match.advancer_team_id then
      v_total := v_total + 2;
    end if;

    -- 4. Persist the score (skip the updated_at trigger to avoid
    --    infinite recursion since this runs inside a trigger chain).
    update public.predictions
    set points = v_total
    where id = v_pred.id;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Trigger: fire score_match when a match finishes
-- ─────────────────────────────────────────────────────────────────────
-- Group-stage matches: status transitions to 'FT'.
-- Knockout matches:    status transitions to 'AET' or 'PEN'.
-- In both cases home_score_120 and away_score_120 must be non-null.

create or replace function public.on_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_knockout boolean;
begin
  -- Only fire when status actually changed on this UPDATE.
  if old.status = new.status then
    return new;
  end if;

  -- Determine if this is a knockout match.
  v_is_knockout := new.stage in ('R32','R16','QF','SF','3RD','FINAL');

  -- Guard: scores must be present.
  if new.home_score_120 is null or new.away_score_120 is null then
    return new;
  end if;

  -- Group stage: score on FT.
  if not v_is_knockout and new.status = 'FT' then
    perform public.score_match(new.id);
  end if;

  -- Knockout: score on AET or PEN (never on FT — that's a 90-min draw,
  -- extra time still pending).
  if v_is_knockout and new.status in ('AET', 'PEN') then
    perform public.score_match(new.id);
  end if;

  return new;
end;
$$;

create trigger trg_match_finished
  after update on public.matches
  for each row execute function public.on_match_finished();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Leaderboard view
-- ─────────────────────────────────────────────────────────────────────
-- This is a REGULAR VIEW — never subscribe to it via Supabase Realtime
-- (views have no WAL). Subscribe to `matches` instead and refetch this
-- view via React Query invalidation.

create or replace view public.v_group_leaderboard as
select
  gm.group_id,
  gm.user_id,
  u.display_name,
  coalesce(sum(p.points), 0)::int                  as total_points,
  count(p.id) filter (where p.joker_used)::int      as jokers_used,
  count(p.id) filter (where p.points is not null)::int as matches_scored
from public.group_members gm
join public.users u on u.id = gm.user_id
left join public.predictions p on p.user_id = gm.user_id and p.points is not null
group by gm.group_id, gm.user_id, u.display_name;
