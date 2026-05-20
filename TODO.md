# TODO — toto-wc26

> **Living checklist.** Every completed chunk is ticked. New work discovered mid-build is appended to the relevant chunk.
> Approved plan: `~/.claude/plans/i-will-provide-you-delegated-crown.md` (v2).

---

## Chunk 1 — Repo + Tooling Skeleton

- [x] `git init` in `C:\Users\ido\toto-il`
- [x] Add remote `https://github.com/iAMido/toto-wc26`
- [x] Write `.gitignore` (Node, Python, Vite, env, IDE, OS)
- [x] Write `README.md`
- [x] Write `TODO.md` (this file)
- [x] Write `ARCHITECTURE.md`
- [x] Write `DATABASE.md`
- [x] Write `SYNC.md`
- [x] Write `I18N.md`
- [x] Write `DEPLOYMENT.md`
- [x] First commit + push to `main`

## Chunk 2 — Vite + React + TS PWA Scaffold (Flat Layout)

- [x] Scaffold Vite + React + TS files at repo root (manual write — no interactive `npm create vite`)
- [x] Install runtime deps: `vite-plugin-pwa`, `react-router-dom`, `@tanstack/react-query`, `react-i18next`, `i18next`, `@supabase/supabase-js`, `@radix-ui/react-slot`
- [x] Configure `vite.config.ts` (PWA manifest with HE/RTL defaults, icons, Supabase NetworkFirst cache)
- [x] Install + init Tailwind CSS (PostCSS + autoprefixer), HSL CSS-vars theme
- [x] shadcn config (`components.json`) + `Button` component + `cn()` util — remaining components (`input`, `card`, `dialog`, `toast`, `radio-group`, `switch`) added in their feature chunks
- [x] `npm run build` is clean (0 errors, 170 KB gz 55 KB, SW generated)
- [x] Commit + push

## Chunk 3 — Supabase Project + Schema (Migrations)

> ⚠️ The Supabase MCP is currently connected to an unrelated project (running/coaching app, 15 tables). **User needs to create a fresh project at supabase.com/dashboard and reconnect the MCP** before `apply_migration` can run safely.

- [x] Create fresh Supabase project `toto-wc26` — ref `zxexfeihapgecttjtsbu`
- [x] Add project-scoped MCP via `claude mcp add --scope project ... project_ref=zxexfeihapgecttjtsbu` (file: `.mcp.json`)
- [x] Write `.env.local` (gitignored) with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [x] Add `supabase.txt` / `secrets.txt` / `credentials.txt` to `.gitignore` so the credentials dump never leaks
- [ ] **NEXT (user action):** Restart Claude Code and authenticate the new supabase MCP (OAuth) — then I'll apply migration 0001
- [x] Write `supabase/migrations/0001_init.sql`
  - [x] `users` synced from `auth.users` via `handle_new_user` trigger
  - [x] `tournaments` (single-row config with WC2026 `start_at`)
  - [x] `groups`, `group_members` (8-char invite codes, composite PK)
  - [x] `tournaments_players` (id, api_player_id, name_en, name_he, team, role with FW/MF/DF/GK check)
  - [x] `matches` (api_fixture_id, kickoff_at, home_team, away_team, stage, status, home_score_120, away_score_120, advancer_team_id, updated_at)
  - [x] `predictions` (user_id, match_id, home, away, joker_used, advancer_team_id, points, created_at, updated_at) with unique (user_id, match_id)
  - [x] `tournament_predictions` (user_id PK, champion, runner-up, scorer/assister IDs + freetexts, locked_at)
- [x] RLS: `predictions` SELECT — own rows always, others only when `now() >= kickoff_at` AND shared group
- [x] RLS: `predictions` INSERT/UPDATE — only when `now() < kickoff_at` AND self
- [x] RLS: `groups` / `group_members` — members read, creator inserts/updates, self join/leave
- [x] RLS: `tournament_predictions` — own always, others after `tournaments.start_at`, self CRUD before start
- [x] DB trigger: reject 4th `joker_used=true` per user (`enforce_joker_cap`)
- [x] `touch_updated_at` trigger on predictions/matches/tournament_predictions
- [x] Enable Realtime publication on `matches` (`alter publication supabase_realtime add table matches`)
- [ ] **BLOCKED:** Apply migration via Supabase MCP `apply_migration` (waiting on fresh project)
- [ ] Commit migration SQL + push (will commit now, mark migration "PENDING APPLY" in TODO)

## Chunk 4 — Scoring Engine (Postgres Function)

- [ ] Write `supabase/migrations/0002_scoring.sql`
  - [ ] `score_match(match_id uuid)` function — +5 / +3 / +1 / 0 ladder
  - [ ] Apply ×2 if `joker_used`
  - [ ] Add +2 advancer bonus on `status='PEN'` AND correct advancer (after joker multiplier)
  - [ ] Trigger on `matches` UPDATE → calls `score_match` when status hits `FT`/`AET`/`PEN` with non-null 120-min scores
  - [ ] View `v_group_leaderboard` (group_id, user_id, total_points, jokers_used)
- [ ] SQL fixture test: group-stage path
- [ ] SQL fixture test: knockout AET path
- [ ] SQL fixture test: knockout PEN + advancer bonus path
- [ ] Apply migration
- [ ] Commit + push

## Chunk 5 — Python Seeding Scripts

- [ ] `sync/requirements.txt` (`requests`, `python-dotenv`, `supabase-py`)
- [ ] `sync/.env.example`
- [ ] `sync/seed_matches.py` — fetch all 72 fixtures and upsert
- [ ] `sync/seed_players.py` — fetch 48 squads, filter forwards/mids, upsert with HE names
- [ ] Document run order + API-Football endpoints in `SYNC.md`
- [ ] Commit + push

## Chunk 6 — Live Sync Edge Function + pg_cron

- [ ] `supabase/functions/sync-fixtures/index.ts` — daily date query + per-match status update
- [ ] `supabase/migrations/0003_cron.sql` — enable `pg_cron`, schedule every 20 min between 10:00–02:00 UTC
- [ ] Smoke-test via manual `supabase functions invoke`
- [ ] Commit + push

## Chunk 7 — Auth + i18n Shell + Joker Budget State

- [ ] `src/lib/supabase.ts` client
- [ ] `src/i18n/i18n.ts` with `react-i18next`, default `he`
- [ ] `src/i18n/en.json`, `src/i18n/he.json` (~40 keys to start)
- [ ] `src/i18n/RtlProvider.tsx` — toggles `<html dir lang>` on language change
- [ ] Routes: `/login`, `/`, `/groups/:id`, `/match/:id`, `/tournament`, `/leaderboard/:groupId`
- [ ] `useRequireAuth` hook
- [ ] `useJokerBudget` hook — React Query query returning `{ used, remaining, jokerMatchIds }`
- [ ] Commit + push

## Chunk 8 — Groups & Membership UI

- [ ] `Groups` page — list + create + join-via-code
- [ ] Group create flow generates 8-char invite code
- [ ] Group detail page (members, leaderboard placeholder, predict next match link)
- [ ] Commit + push

## Chunk 9 — Match Prediction UI (with live Joker enforcement)

- [ ] `MatchPredictionForm` — home/away inputs, joker toggle, knockout advancer radio
- [ ] Joker toggle reads `useJokerBudget()` — disabled at 3 jokers unless this match already has it set
- [ ] On submit success → invalidate joker-budget query
- [ ] RLS-rejection toast (`locked`) on past-kickoff submit
- [ ] Match list page grouped by date with state badges (`🔒 locked / ✏️ open / ⏳ scored`)
- [ ] Commit + push

## Chunk 10 — Delayed Reveal Feed + Realtime Leaderboard

- [ ] Group feed — pre-kickoff shows "submitted/pending" badges, no scores
- [ ] Group feed — post-kickoff fetches & shows all members' scores + joker badges
- [ ] `useRealtimeMatches` hook — `postgres_changes` subscription on `matches` table
- [ ] On `matches.status` flip → invalidate `['leaderboard', groupId]` + `['predictions', matchId]`
- [ ] Optimistic UI on own prediction submit
- [ ] Commit + push

## Chunk 11 — Tournament Predictions UI

- [ ] `TournamentPredictions` page — 4 selectors (Champion, Runner-up, Top Scorer, Top Assister)
- [ ] Free-text fallback for unlisted players
- [ ] RLS-locked at tournament start
- [ ] Commit + push

## Chunk 12 — Final Verification + Deploy

- [ ] `npm run build` clean
- [ ] Manual E2E: two-user reveal test (pre/post kickoff)
- [ ] Manual E2E: group-stage scoring → leaderboard updates within 1s
- [ ] Manual E2E: knockout AET path
- [ ] Manual E2E: knockout PEN + advancer bonus
- [ ] Manual E2E: joker UI cap (3 set → 4th disabled) + DB cap (raw SQL bypass rejected)
- [ ] Manual E2E: HE/EN toggle, `<html dir lang>` flips, no layout breaks
- [ ] PWA install: Chrome Android Add-to-Home-Screen → fullscreen launch
- [ ] Deploy to Vercel + set env vars
- [ ] Smoke-test prod
- [ ] Tick all remaining boxes; final commit + push

---

## Operational prereqs (user must supply before Chunks 3+)

- [ ] API-Football API key
- [ ] Supabase project URL
- [ ] Supabase anon key
- [ ] Supabase service role key
- [ ] Vercel account
- [ ] GitHub auth on this machine (for `git push` to `iAMido/toto-wc26`)
