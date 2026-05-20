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
- [x] Restart Claude Code + authenticate new supabase MCP (OAuth)
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
- [x] Apply migration via Supabase MCP `apply_migration` — success, 8 tables + RLS + triggers + Realtime
- [x] Commit + push

## Chunk 4 — Scoring Engine (Postgres Function)

- [x] Write `supabase/migrations/0002_scoring.sql`
  - [x] `score_match(match_id uuid)` function — +5 / +3 / +1 / 0 ladder
  - [x] Apply ×2 if `joker_used`
  - [x] Add +2 advancer bonus on `status='PEN'` AND correct advancer (after joker multiplier)
  - [x] Trigger `trg_match_finished` on `matches` UPDATE → calls `score_match` via `on_match_finished()` when status hits FT (group stage) or AET/PEN (knockouts) with non-null 120-min scores
  - [x] View `v_group_leaderboard` (group_id, user_id, display_name, total_points, jokers_used, matches_scored)
- [x] SQL fixture test: group-stage exact (+5), wrong (0), goal-diff+joker (+6) — all PASS
- [x] SQL fixture test: knockout AET outcome match (+1), NOT scored at FT — PASS
- [x] SQL fixture test: knockout PEN exact+advancer (+7), goal-diff+wrong-advancer (+3), exact+joker+advancer (+12) — all PASS
- [x] Test data cleaned up from live DB
- [x] Apply migration via MCP — success
- [x] Commit + push

## Chunk 5 — Python Seeding Scripts

- [x] `sync/requirements.txt` (`requests`, `python-dotenv`, `supabase`)
- [x] `sync/.env.example`
- [x] `sync/seed_matches.py` — fetches all fixtures via `/fixtures?league=1&season=2026`, maps round→stage, upserts into `matches`
- [x] `sync/seed_players.py` — fetches 48 squads via `/players/squads`, filters FW+MF, upserts into `tournaments_players`, loads Hebrew names from `he_player_names.json`
- [x] `sync/he_player_names.json` — starter file with ~20 top-player Hebrew names
- [x] Seeded 33 test matches (4 groups + 9 knockout) + 39 players via SQL (API-Football free tier doesn't cover 2026 season — upgrade plan to seed real fixtures)
- [x] Commit + push

## Chunk 6 — Live Sync Edge Function + pg_cron

- [x] `supabase/functions/sync-fixtures/index.ts` — checks ±3h window for active matches, single API-Football call per date, updates statuses + scores, fires scoring trigger
- [x] `supabase/migrations/0003_cron.sql` — enables `pg_cron` + `pg_net`, schedules every 20 min during June-July 0-2h + 10-23h UTC
- [x] **Operational:**
  - [x] Enable `pg_cron` + `pg_net` extensions via SQL
  - [x] Deploy Edge Function `sync-fixtures` via MCP
  - [ ] **Set API_FOOTBALL_KEY secret** — run: `npx supabase login` then `npx supabase secrets set API_FOOTBALL_KEY=304974ea4e93c64910f09ee3d5becd8f --project-ref zxexfeihapgecttjtsbu`
  - [x] Apply migration 0003 (pg_cron schedule) via MCP
- [x] Commit + push

## Chunk 7 — Auth + i18n Shell + Joker Budget State

- [x] `src/lib/supabase.ts` — creates Supabase client from `VITE_` env vars
- [x] `src/i18n/i18n.ts` — i18next init with browser detector, fallback `he`, localStorage cache
- [x] `src/i18n/en.json` (82 keys), `src/i18n/he.json` (82 keys) — full coverage for all pages
- [x] `src/i18n/RtlProvider.tsx` — syncs `<html dir lang>` on mount + `languageChanged` event
- [x] Routes: `/login`, `/`, `/groups`, `/groups/:id`, `/match/:id`, `/tournament`, `/leaderboard/:groupId`
- [x] `src/pages/LoginPage.tsx` — magic-link OTP flow, language toggle
- [x] `src/pages/HomePage.tsx` — post-auth hub with nav to groups/tournament, sign-out, lang toggle
- [x] `src/pages/PlaceholderPage.tsx` — stub for unbuilt routes (Chunks 8-11)
- [x] `src/hooks/useRequireAuth.ts` — session guard, redirects to /login, listens to auth state changes
- [x] `src/hooks/useJokerBudget.ts` — React Query hook: `{ used, remaining, jokerMatchIds }`, 30s stale time, `useInvalidateJokerBudget` helper
- [x] `src/App.tsx` wired: QueryClientProvider + RtlProvider + BrowserRouter + all routes
- [x] `src/main.tsx` imports `i18n/i18n` before render
- [x] `npm run build` clean (0 errors, 495 KB / 146 KB gz)
- [x] Commit + push

## Chunk 8 — Groups & Membership UI

- [x] `Groups` page — list + create + join-via-code
- [x] Group create flow generates 8-char invite code
- [x] `join_group_by_invite_code` RPC (SECURITY DEFINER — bypasses groups SELECT RLS for code lookup)
- [x] Group detail page (members, leaderboard, invite code copy, leave group)
- [x] shadcn `Input` + `Card` components
- [x] i18n keys for groups (EN + HE): createSuccess, joinSuccess, invalidCode, alreadyMember, leaveGroup, shareCode, creator
- [x] Commit + push

## Chunk 9 — Match Prediction UI (with live Joker enforcement)

- [x] `MatchPredictionPage` — home/away inputs, joker toggle, knockout advancer radio
- [x] Joker toggle reads `useJokerBudget()` — disabled at 3 jokers unless this match already has it set
- [x] On submit success → invalidate joker-budget query
- [x] RLS-rejection toast (`locked`) on past-kickoff submit
- [x] `MatchListPage` grouped by date with status badges (open / predicted / locked / scored)
- [x] `/matches` route + nav link on HomePage
- [x] i18n keys: allMatches, predicted, result (EN + HE)
- [x] Commit + push

## Chunk 10 — Delayed Reveal Feed + Realtime Leaderboard

- [x] Group feed — pre-kickoff shows "submitted/pending" badges, no scores (via `get_match_predictions_for_group` RPC)
- [x] Group feed — post-kickoff fetches & shows all members' scores + joker badges
- [x] `useRealtimeMatches` hook — `postgres_changes` subscription on `matches` table
- [x] On `matches.status` flip → invalidate leaderboard, predictions, group-feed queries
- [x] `GroupMatchFeed` component (upcoming 5 + recent 5), embedded in GroupDetailPage
- [x] Migration 0005: `get_match_predictions_for_group` SECURITY DEFINER RPC (delayed reveal)
- [x] Realtime hook added to MatchListPage + GroupDetailPage
- [x] Optimistic UI via React Query invalidation on prediction submit
- [x] i18n keys: feed.upcoming, feed.recent, feed.submitted, feed.pending, feed.viewAll (EN + HE)
- [x] Commit + push

## Chunk 11 — Tournament Predictions UI

- [x] `TournamentPredictionsPage` — 4 selectors (Champion, Runner-up, Top Scorer, Top Assister)
- [x] Players grouped by team in `<optgroup>` with bilingual names (HE/EN)
- [x] Free-text fallback for unlisted players (scorer + assister)
- [x] RLS-locked at tournament start (checks `tournaments.start_at`)
- [x] i18n: selectTeam key (EN + HE)
- [x] Commit + push

## Chunk 12 — Final Verification + Deploy

- [x] `npm run build` clean (0 errors, 540 KB / 157 KB gz)
- [x] `vercel.json` — Vite framework, SPA rewrites, dist output
- [ ] Manual E2E: two-user reveal test (pre/post kickoff)
- [ ] Manual E2E: group-stage scoring → leaderboard updates within 1s
- [ ] Manual E2E: knockout AET path
- [ ] Manual E2E: knockout PEN + advancer bonus
- [ ] Manual E2E: joker UI cap (3 set → 4th disabled) + DB cap (raw SQL bypass rejected)
- [ ] Manual E2E: HE/EN toggle, `<html dir lang>` flips, no layout breaks
- [ ] PWA install: Chrome Android Add-to-Home-Screen → fullscreen launch
- [x] Deploy to Vercel + set env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [x] Production URL: **https://toto-il.vercel.app**
- [ ] Smoke-test prod
- [ ] Manual E2E tests (two-user reveal, scoring, joker cap, i18n, PWA install)
- [ ] Tick all remaining boxes; final commit + push

## Post-launch Improvements (user feedback)

- [x] Redesigned HomePage — action cards, scoring rules, joker budget pill, gradient background
- [x] Redesigned LoginPage — card layout, gradient background, success state
- [x] Stage grouping — MatchListPage now groups by stage (Group A–L, R32–Final) instead of date
- [x] Phase tabs — Group Stage / Knockout toggle with open-match counters
- [x] Stage name translations — 18 stages in EN + HE (בית A, שמינית גמר, etc.)
- [x] Improved Hebrew translations — more natural phrasing across all sections
- [x] Sporty emerald-green CSS theme with stage header utilities
- [x] Stage names in MatchPredictionPage and GroupMatchFeed
- [x] Seeded 64 additional players — 103 total across 31 teams (was 39/15)
- [x] Deployed to production: https://toto-il.vercel.app

---

## Operational prereqs (user must supply before Chunks 3+)

- [x] API-Football API key (free tier — doesn't cover 2026 season; upgrade needed for real fixtures)
- [x] Supabase project URL
- [x] Supabase anon key
- [x] Supabase service role key
- [x] Vercel account
- [x] GitHub auth on this machine (for `git push` to `iAMido/toto-wc26`)

## Remaining manual steps

- [ ] **Supabase Auth redirect URL** — Dashboard → Authentication → URL Configuration → add `https://toto-il.vercel.app` to Site URL and Redirect URLs
- [ ] **Set Edge Function secret** — run: `npx supabase login` then `npx supabase secrets set API_FOOTBALL_KEY=304974ea4e93c64910f09ee3d5becd8f --project-ref zxexfeihapgecttjtsbu`
- [ ] **Upgrade API-Football plan** — free tier blocks 2026 season data; upgrade to access real WC2026 fixtures, then re-run `python sync/seed_matches.py`
