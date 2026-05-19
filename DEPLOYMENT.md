# Deployment — toto-wc26

Two systems to provision: **Supabase Cloud** (DB + Auth + Edge Functions + pg_cron) and **Vercel** (PWA static hosting).

## Environment variables

### Frontend (`.env.local`, Vercel project env)

| Variable | Source | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project settings → API | Public-safe |
| `VITE_SUPABASE_ANON_KEY` | Supabase project settings → API → `anon` | Public-safe (RLS protects rows) |

`VITE_` prefix is required by Vite to expose to client code.

### Edge Function (`supabase secrets`)

| Variable | Source | Notes |
|---|---|---|
| `API_FOOTBALL_KEY` | RapidAPI / API-Football dashboard | Server-only |
| `SUPABASE_URL` | auto-injected by Supabase runtime | |
| `SUPABASE_SERVICE_ROLE_KEY` | auto-injected by Supabase runtime | Server-only |

Set with: `supabase secrets set API_FOOTBALL_KEY=...`

### Python seeders (`sync/.env`, never committed)

| Variable | Source |
|---|---|
| `API_FOOTBALL_KEY` | RapidAPI / API-Football |
| `SUPABASE_URL` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings (admin) |

## Supabase setup steps

1. Create new project at supabase.com (region: closest to Israel — `eu-central-1` is typical).
2. Enable email auth with magic link (Auth → Providers → Email).
3. Apply migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
4. Deploy Edge Function:
   ```bash
   supabase functions deploy sync-fixtures
   supabase secrets set API_FOOTBALL_KEY=<your-key>
   ```
5. Enable `pg_cron` + `pg_net` extensions (Database → Extensions, or via the `0003_cron.sql` migration).
6. Verify Realtime publication includes `matches`: Database → Replication → `supabase_realtime` → ensure `matches` is checked.

## Vercel setup

1. Connect GitHub repo `iAMido/toto-wc26` to Vercel.
2. Framework preset: **Vite** (autodetected from `package.json` at repo root).
3. Build command: `npm run build`. Output directory: `dist`.
4. Add the two `VITE_*` env vars in Vercel Project Settings → Environment Variables (apply to Production + Preview + Development).
5. Deploy. The PWA manifest and service worker are emitted by `vite-plugin-pwa` during build.

## PWA install verification

After deploy:
1. Open the prod URL in Chrome (Android) or Safari (iOS).
2. Chrome: menu → "Add to Home Screen" → app launches in standalone (no browser chrome).
3. iOS: Share → "Add to Home Screen" → same behavior.
4. Confirm offline shell works: turn airplane mode on, reopen app → login screen renders from cached assets (live data is gated behind auth and will surface a connection error, which is correct).

## Backups & rollback

- Supabase auto-backups daily on free tier.
- Migrations are forward-only — any schema mistake is fixed by adding a new migration, not editing an existing one.
- Vercel keeps every deployment; rollback is a one-click "Promote to Production" on a previous build.

## Local dev quickstart

```bash
# 1. Frontend
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_* values
npm run dev                  # http://localhost:5173

# 2. Apply DB locally (optional — usually we push straight to cloud staging)
supabase start
supabase db push

# 3. Run seeders once
cd sync && pip install -r requirements.txt
cp .env.example .env         # fill in API_FOOTBALL_KEY + SUPABASE_*
python seed_matches.py
python seed_players.py
```
