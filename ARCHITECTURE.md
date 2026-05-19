# Architecture — toto-wc26

## High-level

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser / Installed PWA                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ React + Vite + TS                                            │   │
│  │   - shadcn/ui (Tailwind)        - react-i18next (HE/EN+RTL)  │   │
│  │   - @tanstack/react-query       - vite-plugin-pwa (offline)  │   │
│  │   - @supabase/supabase-js (auth, queries, realtime)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTPS / WSS (REST + Realtime)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Supabase Cloud                                │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐│
│  │ Postgres                     │  │ Auth (Magic Link)            ││
│  │  - users, groups, matches,   │  │                              ││
│  │    predictions, ...          │  └──────────────────────────────┘│
│  │  - RLS (lock/reveal logic)   │  ┌──────────────────────────────┐│
│  │  - score_match() fn          │  │ Realtime (WAL → WebSocket)   ││
│  │  - trigger on matches UPDATE │  │  - publication on `matches`  ││
│  │  - v_group_leaderboard view  │  └──────────────────────────────┘│
│  │  - pg_cron jobs              │  ┌──────────────────────────────┐│
│  └──────────────────────────────┘  │ Edge Functions (Deno/TS)     ││
│                                    │  - sync-fixtures             ││
│                                    └──────────────────────────────┘│
└────────────────────────────────────────┬────────────────────────────┘
                                         │ HTTPS (during match windows)
                                         ▼
                              ┌──────────────────────┐
                              │   API-Football       │
                              │  /fixtures?date=...  │
                              └──────────────────────┘

                              ┌──────────────────────┐
                              │ One-time Python      │  (run from dev machine,
                              │ seeders (sync/)      │   off API budget)
                              │  - seed_players      │
                              │  - seed_matches      │
                              └──────────────────────┘
```

## Sequence: kickoff lock (anti-late-edit)

```
User                    Browser                     Supabase
  │                       │                            │
  │ "submit prediction"   │                            │
  ├──────────────────────▶│                            │
  │                       │ upsert predictions row    │
  │                       ├───────────────────────────▶│
  │                       │                            │ RLS: WHERE now() < matches.kickoff_at
  │                       │                            │   ✓ → INSERT
  │                       │                            │   ✗ → 403
  │                       │  200 / 403                 │
  │                       │◀───────────────────────────┤
  │ toast: saved / locked │                            │
  │◀──────────────────────┤                            │
```

The client clock is irrelevant — every write is rechecked by Postgres against `now()` at the moment the row hits the table.

## Sequence: scoring + realtime leaderboard

```
pg_cron (every 20m)            Edge Fn               Postgres                Browsers (all members)
       │                          │                      │                          │
       │ invoke sync-fixtures     │                      │                          │
       ├─────────────────────────▶│                      │                          │
       │                          │ GET /fixtures?date=… │                          │
       │                          │  to API-Football     │                          │
       │                          │                      │                          │
       │                          │ UPDATE matches       │                          │
       │                          │  SET status='FT',    │                          │
       │                          │      home_score_120, │                          │
       │                          │      away_score_120  │                          │
       │                          ├─────────────────────▶│                          │
       │                          │                      │ trigger fires →          │
       │                          │                      │  score_match(match_id)   │
       │                          │                      │  → UPDATE predictions    │
       │                          │                      │     SET points = …       │
       │                          │                      │                          │
       │                          │                      │ WAL → Realtime broadcast │
       │                          │                      │  (matches table change)  │
       │                          │                      ├──────────────────────────▶│
       │                          │                      │                          │
       │                          │                      │       React Query        │
       │                          │                      │       invalidates:       │
       │                          │                      │     ['leaderboard',gid]  │
       │                          │                      │     ['predictions',mid] │
       │                          │                      │                          │
       │                          │                      │   refetch leaderboard +  │
       │                          │                      │       member preds       │
       │                          │                      │◀─────────────────────────┤
       │                          │                      │                          │
       │                          │                      │      UI updates 🎉       │
```

Note: Supabase Realtime broadcasts from WAL, which views don't produce. We subscribe to **`matches`** (a real table) and let React Query refetch the leaderboard **view** as a side effect.

## Joker budget (dual-layer enforcement)

1. **Client (UX layer):** `useJokerBudget()` hook returns `{ used, remaining, jokerMatchIds }` by selecting all of the current user's predictions with `joker_used=true`. Joker toggle is disabled on any match card where `remaining === 0` and that match's joker isn't already set.
2. **Server (correctness layer):** Postgres trigger on `predictions` INSERT/UPDATE counts the user's `joker_used=true` rows in the current tournament and raises an exception at >3. This catches race conditions and any direct-SQL bypass.

## i18n + RTL

- Default locale: `he` (Hebrew, RTL).
- `RtlProvider` sets `<html dir lang>` on mount and on every language change.
- Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`) ensure layouts mirror correctly.
- Team and player names: store both `name_en` and `name_he` columns; render the one matching active locale.

## Offline / PWA

- `vite-plugin-pwa` generates a Service Worker.
- Cache strategy: app shell + locale JSON + static assets are precached; Supabase API calls are network-first (predictions never go stale silently).
- Manifest declares `display: standalone`, theme color, and icons sized for Android/iOS home screens.
