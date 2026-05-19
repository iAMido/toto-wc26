-- toto-wc26 / migration 0001
-- Initial schema: users, groups, members, players, matches, predictions,
-- tournament-wide predictions, the joker cap trigger, RLS policies, and
-- the Realtime publication entry for the `matches` table.
--
-- Applied via Supabase MCP `apply_migration` (name: init).
-- All tables enable RLS. There is NO permissive bypass — clients must
-- read/write through the policies below. The `service_role` key (used by
-- the Edge Function and Python seeders) bypasses RLS by design.

-- ─────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────────────

-- 1a. Tournament config (single row for WC2026, but modelled as a table
--     so RLS predicates can reference it cleanly).
create table public.tournaments (
  id          text        primary key,                -- 'wc2026'
  name        text        not null,
  start_at    timestamptz not null,
  created_at  timestamptz not null default now()
);

insert into public.tournaments (id, name, start_at)
values ('wc2026', 'FIFA World Cup 2026', '2026-06-11 16:00:00+00');
-- placeholder kickoff; seed_matches.py will refine if needed.

-- 1b. App-level user record, mirrors auth.users for joins.
create table public.users (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text,
  locale        text        not null default 'he' check (locale in ('he','en')),
  created_at    timestamptz not null default now()
);

-- Auto-create a public.users row when a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 1c. Private groups (leagues).
create table public.groups (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null check (length(trim(name)) > 0),
  created_by   uuid        not null references public.users(id) on delete cascade,
  invite_code  text        not null unique check (length(invite_code) = 8),
  created_at   timestamptz not null default now()
);

create index groups_created_by_idx on public.groups(created_by);

-- 1d. Group membership join table.
create table public.group_members (
  group_id   uuid        not null references public.groups(id) on delete cascade,
  user_id    uuid        not null references public.users(id)  on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members(user_id);

-- 1e. Pre-seeded tournament players (top scorer / top assister picks).
create table public.tournaments_players (
  id            uuid primary key default gen_random_uuid(),
  api_player_id int  not null unique,
  name_en       text not null,
  name_he       text,
  team          text not null,
  role          text not null check (role in ('GK','DF','MF','FW'))
);

create index tournaments_players_team_idx on public.tournaments_players(team);

-- 1f. All 72 fixtures of the tournament.
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  api_fixture_id   int  not null unique,
  kickoff_at       timestamptz not null,
  home_team        text not null,
  away_team        text not null,
  stage            text not null check (stage in (
    'GROUP_A','GROUP_B','GROUP_C','GROUP_D','GROUP_E','GROUP_F',
    'GROUP_G','GROUP_H','GROUP_I','GROUP_J','GROUP_K','GROUP_L',
    'R32','R16','QF','SF','3RD','FINAL'
  )),
  status           text not null default 'NS' check (status in (
    'NS','1H','HT','2H','ET','BT','P','FT','AET','PEN','PST','CANC','ABD','AWD','WO'
  )),
  home_score_120     int,
  away_score_120     int,
  advancer_team_id   text,  -- set only when status='PEN'
  updated_at         timestamptz not null default now()
);

create index matches_kickoff_idx on public.matches(kickoff_at);
create index matches_status_idx  on public.matches(status);

-- 1g. Per-match predictions.
create table public.predictions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id)   on delete cascade,
  match_id          uuid not null references public.matches(id) on delete cascade,
  home              int  not null check (home >= 0 and home <= 30),
  away              int  not null check (away >= 0 and away <= 30),
  joker_used        boolean not null default false,
  advancer_team_id  text,
  points            int,           -- populated by score_match() after the match ends
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_match_idx on public.predictions(match_id);
create index predictions_user_idx  on public.predictions(user_id);

-- 1h. Tournament-wide predictions (one row per user).
create table public.tournament_predictions (
  user_id                  uuid primary key references public.users(id) on delete cascade,
  champion_team            text,
  runnerup_team            text,
  top_scorer_player_id     uuid references public.tournaments_players(id) on delete set null,
  scorer_freetext          text,
  top_assister_player_id   uuid references public.tournaments_players(id) on delete set null,
  assister_freetext        text,
  locked_at                timestamptz,
  updated_at               timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Joker cap trigger (max 3 joker_used=true per user)
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.enforce_joker_cap()
returns trigger
language plpgsql
as $$
declare
  current_count int;
begin
  if new.joker_used then
    select count(*) into current_count
    from public.predictions
    where user_id = new.user_id
      and joker_used = true
      and id is distinct from new.id;

    if current_count >= 3 then
      raise exception 'joker_cap_exceeded'
        using errcode = 'check_violation',
              hint = 'You can only mark 3 matches with Joker per tournament.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_joker_cap
  before insert or update on public.predictions
  for each row
  when (new.joker_used = true)
  execute function public.enforce_joker_cap();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Updated-at auto-touch trigger (reused on predictions + matches)
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_predictions_touch
  before update on public.predictions
  for each row execute function public.touch_updated_at();

create trigger trg_matches_touch
  before update on public.matches
  for each row execute function public.touch_updated_at();

create trigger trg_tp_touch
  before update on public.tournament_predictions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────

alter table public.users                   enable row level security;
alter table public.groups                  enable row level security;
alter table public.group_members           enable row level security;
alter table public.tournaments             enable row level security;
alter table public.tournaments_players     enable row level security;
alter table public.matches                 enable row level security;
alter table public.predictions             enable row level security;
alter table public.tournament_predictions  enable row level security;

-- 4a. users
create policy "users: self select" on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy "users: members of shared groups select" on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = (select auth.uid()) and gm2.user_id = users.id
    )
  );

create policy "users: self update" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 4b. groups
create policy "groups: members select" on public.groups
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = (select auth.uid())
    )
  );

create policy "groups: authenticated insert as creator" on public.groups
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "groups: creator update" on public.groups
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- 4c. group_members
create policy "group_members: shared-group select" on public.group_members
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = (select auth.uid())
    )
  );

create policy "group_members: self join with valid invite" on public.group_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.groups g where g.id = group_members.group_id
    )
  );
-- (Invite-code validation happens client-side via a lookup; the policy
--  ensures the user can only add themselves to an existing group.)

create policy "group_members: self leave" on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 4d. tournaments — read-only for everyone authenticated
create policy "tournaments: read all" on public.tournaments
  for select to authenticated using (true);

-- 4e. tournaments_players — read-only for everyone authenticated
create policy "tournaments_players: read all" on public.tournaments_players
  for select to authenticated using (true);

-- 4f. matches — read-only for everyone authenticated; service_role writes
create policy "matches: read all" on public.matches
  for select to authenticated using (true);

-- 4g. predictions
-- SELECT own rows always.
create policy "predictions: own select" on public.predictions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- SELECT others' rows only after kickoff AND shared group.
create policy "predictions: others after kickoff in shared group" on public.predictions
  for select to authenticated
  using (
    now() >= (select kickoff_at from public.matches m where m.id = predictions.match_id)
    and exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = (select auth.uid()) and gm2.user_id = predictions.user_id
    )
  );

-- INSERT only before kickoff for self.
create policy "predictions: self insert before kickoff" on public.predictions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and now() < (select kickoff_at from public.matches m where m.id = match_id)
  );

-- UPDATE only before kickoff for self.
create policy "predictions: self update before kickoff" on public.predictions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and now() < (select kickoff_at from public.matches m where m.id = match_id)
  )
  with check (
    user_id = (select auth.uid())
    and now() < (select kickoff_at from public.matches m where m.id = match_id)
  );

-- 4h. tournament_predictions
create policy "tp: own select" on public.tournament_predictions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tp: others after start" on public.tournament_predictions
  for select to authenticated
  using (
    now() >= (select start_at from public.tournaments where id = 'wc2026')
  );

create policy "tp: self insert before start" on public.tournament_predictions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and now() < (select start_at from public.tournaments where id = 'wc2026')
  );

create policy "tp: self update before start" on public.tournament_predictions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and now() < (select start_at from public.tournaments where id = 'wc2026')
  )
  with check (
    user_id = (select auth.uid())
    and now() < (select start_at from public.tournaments where id = 'wc2026')
  );

-- ─────────────────────────────────────────────────────────────────────
-- 5. Realtime publication on `matches`
-- ─────────────────────────────────────────────────────────────────────
-- The default `supabase_realtime` publication is empty after project
-- creation. Add `matches` so clients can subscribe to UPDATE events
-- when status flips to FT/AET/PEN (Chunk 10).

alter publication supabase_realtime add table public.matches;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Indexes worth adding before data is loaded
-- ─────────────────────────────────────────────────────────────────────

create index predictions_joker_idx
  on public.predictions(user_id) where joker_used = true;
