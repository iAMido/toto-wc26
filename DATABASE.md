# Database — toto-wc26

All tables live in the default `public` schema. RLS is **enabled on every table** with no permissive bypass. The service role key is used only by the Edge Function (`sync-fixtures`) and the Python seeders.

## Tables

### `users`
Mirrors `auth.users` for joins. Populated by a trigger on `auth.users` insert.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | matches `auth.users.id` |
| `display_name` | `text` | user-editable |
| `locale` | `text` | `'he'` or `'en'`, default `'he'` |
| `created_at` | `timestamptz` | |

### `groups`
Private leagues.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `created_by` | `uuid` FK → `users.id` | |
| `invite_code` | `text` UNIQUE | 8-char alphanumeric |
| `created_at` | `timestamptz` | |

### `group_members`
Composite PK (group_id, user_id).

| column | type | notes |
|---|---|---|
| `group_id` | `uuid` FK → `groups.id` | |
| `user_id` | `uuid` FK → `users.id` | |
| `joined_at` | `timestamptz` | |

### `tournaments_players`
Seeded once from API-Football squads; used to populate Top Scorer / Top Assister dropdowns.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `api_player_id` | `int` UNIQUE | from API-Football |
| `name_en` | `text` | |
| `name_he` | `text` | manual mapping for top ~100 players |
| `team` | `text` | country code or name |
| `role` | `text` | `'FW'`, `'MF'`, etc. (filter to attacking roles) |

### `matches`
Seeded once with all 72 fixtures; status + scores updated by `sync-fixtures` Edge Function.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `api_fixture_id` | `int` UNIQUE | from API-Football |
| `kickoff_at` | `timestamptz` | **the lock-time pivot** |
| `home_team` | `text` | |
| `away_team` | `text` | |
| `stage` | `text` | `'GROUP_A'..'GROUP_L'`, `'R32'`, `'R16'`, `'QF'`, `'SF'`, `'3RD'`, `'FINAL'` |
| `status` | `text` | `'NS'`, `'1H'`, `'HT'`, `'2H'`, `'ET'`, `'FT'`, `'AET'`, `'PEN'` |
| `home_score_120` | `int NULL` | final after extra time (or 90' for group stage) |
| `away_score_120` | `int NULL` | |
| `advancer_team_id` | `text NULL` | winner of penalty shootout (only set when `status='PEN'`) |
| `updated_at` | `timestamptz` | |

Realtime publication is enabled on this table (`supabase_realtime`).

### `predictions`
One row per (user, match). Upsert on submit, scored by trigger after match ends.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` | |
| `match_id` | `uuid` FK → `matches.id` | |
| `home` | `int` | predicted home score |
| `away` | `int` | predicted away score |
| `joker_used` | `boolean` default `false` | |
| `advancer_team_id` | `text NULL` | required when prediction is a draw on a knockout match |
| `points` | `int NULL` | populated by `score_match()` after match finishes |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

UNIQUE (`user_id`, `match_id`).

### `tournament_predictions`
One row per user.

| column | type | notes |
|---|---|---|
| `user_id` | `uuid` PK FK → `users.id` | |
| `champion_team` | `text` | |
| `runnerup_team` | `text` | |
| `top_scorer_player_id` | `uuid NULL` FK → `tournaments_players.id` | |
| `scorer_freetext` | `text NULL` | when user picks an unlisted player |
| `top_assister_player_id` | `uuid NULL` FK → `tournaments_players.id` | |
| `assister_freetext` | `text NULL` | |
| `locked_at` | `timestamptz NULL` | filled at tournament kickoff |

## RLS policies (summary)

| table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` | self + members of shared groups | trigger only | self | – |
| `groups` | members of group | authenticated | creator | – |
| `group_members` | members of same group | self-join with valid invite_code | – | self |
| `matches` | all authenticated | service role only | service role only | – |
| `predictions` | self always; others where `now() >= matches.kickoff_at AND share a group` | self where `now() < matches.kickoff_at` | self where `now() < matches.kickoff_at` | – |
| `tournament_predictions` | self; others after tournament start | self before tournament start | self before tournament start | – |

The `now() < matches.kickoff_at` check is the **single source of truth** for kickoff lock. The client never decides.

## Joker cap trigger

```
CREATE FUNCTION enforce_joker_cap() RETURNS trigger AS $$
BEGIN
  IF NEW.joker_used THEN
    IF (
      SELECT COUNT(*) FROM predictions
      WHERE user_id = NEW.user_id
        AND joker_used = true
        AND id <> COALESCE(NEW.id, gen_random_uuid())
    ) >= 3 THEN
      RAISE EXCEPTION 'joker_cap_exceeded';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_joker_cap
  BEFORE INSERT OR UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION enforce_joker_cap();
```

## Scoring function (`score_match`)

Pseudocode:

```
function score_match(match_id):
  m = SELECT * FROM matches WHERE id = match_id
  IF m.home_score_120 IS NULL OR m.away_score_120 IS NULL: RETURN

  FOR each p IN predictions WHERE match_id = m.id:
    base = 0
    IF p.home = m.home_score_120 AND p.away = m.away_score_120:
        base = 5
    ELSE IF (p.home - p.away) = (m.home_score_120 - m.away_score_120):
        base = 3
    ELSE IF sign(p.home - p.away) = sign(m.home_score_120 - m.away_score_120):
        base = 1
    ELSE:
        base = 0

    IF p.joker_used:
        base = base * 2

    -- Advancer bonus (knockout decided by penalties). Added AFTER joker, not multiplied.
    IF m.status = 'PEN' AND p.advancer_team_id IS NOT NULL
       AND p.advancer_team_id = m.advancer_team_id:
        base = base + 2

    UPDATE predictions SET points = base WHERE id = p.id
```

Triggered when `matches` UPDATE causes `status` to become `FT` / `AET` / `PEN` and the 120-min scores are non-null.

## Leaderboard view

```
CREATE VIEW v_group_leaderboard AS
SELECT
  gm.group_id,
  gm.user_id,
  u.display_name,
  COALESCE(SUM(p.points), 0) AS total_points,
  COUNT(p.id) FILTER (WHERE p.joker_used) AS jokers_used
FROM group_members gm
JOIN users u ON u.id = gm.user_id
LEFT JOIN predictions p ON p.user_id = gm.user_id
GROUP BY gm.group_id, gm.user_id, u.display_name;
```

**Reminder:** never `realtime.subscribe()` to this view — views have no WAL. Subscribe to `matches` and refetch this view via React Query.
