# Data sync — toto-wc26

Two layers of data sync, one Python and one Deno, with very different operational profiles.

## Layer 1 — Python one-off seeders (`sync/`)

Run locally from a dev machine **before** the tournament starts. Off API budget (squads endpoint has its own quota that doesn't matter at this scale).

### `sync/seed_matches.py`

Runs once. Fetches all 72 group-stage + knockout fixtures from API-Football and upserts them into the `matches` table.

- Endpoint: `GET /fixtures?league=<wc-id>&season=2026`
- Maps API response → `matches` rows: `api_fixture_id`, `kickoff_at`, `home_team`, `away_team`, `stage`, `status='NS'`.
- Idempotent on `api_fixture_id` (upsert).

### `sync/seed_players.py`

Runs once after `seed_matches.py`. Fetches squads for all 48 participating teams, filters for attacking roles (`FW`, `MF` with attacking sub-role), and upserts into `tournaments_players`.

- Endpoint: `GET /players/squads?team=<id>` (48 calls, one-time)
- Filters: roles `FW`, `MF` only — keeps the dropdown tractable.
- Hebrew names: maintained in a manual mapping file `sync/he_player_names.json`, keyed by `api_player_id`. Unmapped players default `name_he` to `name_en` (Hebrew users still see the EN spelling — acceptable for niche players).

### Files

```
sync/
├── requirements.txt        # requests, python-dotenv, supabase-py
├── .env.example            # API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
├── .env                    # gitignored
├── seed_matches.py
├── seed_players.py
└── he_player_names.json    # api_player_id → "name in Hebrew"
```

### Run order

```
cd sync
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
python seed_matches.py    # ~1 API call
python seed_players.py    # ~48 API calls
```

## Layer 2 — Supabase Edge Function (`sync-fixtures`)

Active during the tournament. Scheduled by `pg_cron` every 20 min between 10:00 and 02:00 UTC (covers all kickoff windows from Mexico to Asia time zones).

### Logic

```typescript
// supabase/functions/sync-fixtures/index.ts (sketch)
serve(async () => {
  const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD

  // Is there anything to do?
  const active = await sb.from('matches')
    .select('id, api_fixture_id')
    .gte('kickoff_at', new Date(Date.now() - 3*3600*1000).toISOString())
    .lte('kickoff_at', new Date(Date.now() + 3*3600*1000).toISOString())
    .not('status', 'in', '("FT","AET","PEN")');
  if (active.data?.length === 0) return new Response('idle');

  // Single API call covers all concurrent fixtures today.
  const res = await fetch(`${API_FOOTBALL}/fixtures?date=${today}`, {
    headers: { 'x-rapidapi-key': API_FOOTBALL_KEY }
  });
  const json = await res.json();

  // Update each match whose status changed.
  for (const fx of json.response) {
    const status = fx.fixture.status.short; // 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'FT' | 'AET' | 'PEN'
    const homeFinal = fx.score.fulltime.home ?? fx.goals.home;
    const awayFinal = fx.score.fulltime.away ?? fx.goals.away;
    const advancer  = status === 'PEN' ? winnerFromPenalties(fx) : null;

    if (['FT','AET','PEN'].includes(status)) {
      // The matches UPDATE fires the scoring trigger.
      await sb.from('matches').update({
        status, home_score_120: homeFinal, away_score_120: awayFinal,
        advancer_team_id: advancer, updated_at: new Date().toISOString()
      }).eq('api_fixture_id', fx.fixture.id);
    }
  }

  return new Response('ok');
});
```

### Schedule (`supabase/migrations/0003_cron.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'sync-fixtures-every-20m',
  '*/20 10-23,0-2 * * *',
  $$
    SELECT net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/sync-fixtures',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
    );
  $$
);
```

(The service role key is stored via `ALTER DATABASE … SET app.service_role_key = '...'` so it isn't hardcoded in the migration.)

### API-Football call budget

- Group stage: max 4 matches per day × 1 endpoint call covers them all → ~6 calls/day during active hours (10:00–02:00 UTC = 16h, every 20m only when active matches exist).
- Knockouts: 1–2 matches per day → far less.
- Squads seeding (Layer 1): 48 calls, one-time, not on the daily budget.
- **Cap target: ≤20 calls/day**, well under the free-tier 100/day limit.

### Knockout edge cases

- Group-stage matches finalize at `FT`. Scoring fires.
- Knockout matches at 90' draw → API status is `FT` but with extra time pending. We **do not** trigger scoring; we wait for `AET` or `PEN`.
- The trigger predicate on `matches` checks the stage: group-stage rows score on `FT`, knockout rows score only on `AET`/`PEN`.
- Penalty winner: parse `fx.teams.home.winner` / `fx.teams.away.winner` after `status='PEN'`.
