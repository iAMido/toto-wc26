# toto-wc26 — World Cup 2026 Prediction PWA

A Progressive Web App for managing private-group predictions on all 72 matches of the 2026 FIFA World Cup, plus tournament-wide picks (Champion, Runner-up, Top Scorer, Top Assister). Bilingual: **Hebrew (RTL, default)** and **English (LTR)**.

## What it does

- Users register (Supabase magic-link auth) and join private invite-only groups.
- For every match: submit a predicted score, optionally use a **Joker** (×2 multiplier, max 3 per tournament).
- For knockout matches: if you predict a draw, you must also pick which team advances on penalties (+2 bonus if correct).
- Other users' predictions are hidden until kickoff (anti-copy).
- Real-time group leaderboard updates the moment a match is scored.
- Scoring is automatic, driven by API-Football fixture polling every 20 min during match windows.

## Scoring (per match)

| Outcome | Points |
|---|---|
| Exact score | +5 |
| Goal difference matches | +3 |
| Match outcome matches (1 / X / 2) | +1 |
| Otherwise | 0 |
| Joker applied | × 2 |
| Penalty-shootout advancer pick correct | + 2 (added **after** joker, not multiplied) |

Knockout matches are scored only when the API reports `AET` or `PEN` — never at the 90-minute whistle.

## Tech stack

- **Frontend**: Vite + React + TypeScript, `vite-plugin-pwa`, Tailwind CSS + shadcn/ui, `react-i18next`.
- **Backend**: Supabase — Postgres + Auth + Row-Level Security + Realtime.
- **Scoring**: Postgres function triggered when a match's `status` changes to `FT` / `AET` / `PEN`.
- **Live sync**: Supabase Edge Function (Deno/TS) scheduled by `pg_cron`, calling API-Football's `/fixtures?date=` endpoint.
- **Seeding** (one-time): Python scripts in `sync/` for squads + fixtures.
- **Deployment**: Vercel (PWA) + Supabase Cloud.

## Repo layout

```
.
├── package.json + vite.config.ts + src/        # Vite PWA at repo root
├── supabase/migrations/                         # SQL schema, RLS, scoring, pg_cron
├── supabase/functions/sync-fixtures/            # live API-Football polling
└── sync/                                        # Python one-off seeders
```

## Docs

- [`TODO.md`](TODO.md) — living checklist; the source of truth for what's done and what's next.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system diagram, data flow, sequence diagrams.
- [`DATABASE.md`](DATABASE.md) — table schemas, RLS predicates, scoring procedure.
- [`SYNC.md`](SYNC.md) — Python seed scripts, Edge Function loop, pg_cron schedule, API budget.
- [`I18N.md`](I18N.md) — locale keys, RTL handling.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Vercel + Supabase setup, env vars, secrets.

## Quickstart (will fill in as chunks complete)

```bash
# Frontend
npm install
npm run dev

# Apply DB migrations (via Supabase CLI or MCP)
supabase db push

# Run one-off seeders (Python)
cd sync && pip install -r requirements.txt && python seed_matches.py && python seed_players.py
```

## Status

Initial scaffolding — see `TODO.md` for current chunk progress.
