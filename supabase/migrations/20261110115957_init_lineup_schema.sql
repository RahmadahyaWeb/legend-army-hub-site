-- Legend Army Hub: Guild League lineup schema
-- Spec: .scratch/guild-league-lineup/spec.md §4.2, §4.5

create type member_lane as enum ('top', 'mid', 'bot');

-- Member guild (bukan user aplikasi)
create table guild_members (
  id                  uuid primary key default gen_random_uuid(),
  source_id           integer,
  player_name         text not null unique,
  level               integer not null,
  class_name          text not null,
  title               text not null,
  gender              text not null,
  guild_rank          text not null,
  gear_score          integer not null,
  weekly              integer not null,
  weekly_contribution integer not null,
  total_contribution  integer not null,
  online_status       text not null,
  is_online           boolean not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 12 tim, lane = label
create table teams (
  position smallint primary key check (position between 1 and 12),
  lane member_lane not null
);

-- Slot lineup: 1 member per slot, 1 tim per member
create table lineup_slots (
  team_position smallint not null references teams(position) on delete cascade,
  slot_no        smallint not null check (slot_no between 1 and 5),
  member_id      uuid not null unique references guild_members(id) on delete cascade,
  primary key (team_position, slot_no)
);

create index idx_members_gear_score on guild_members (gear_score desc);
create index idx_members_rank_class on guild_members (guild_rank, class_name);
create index idx_members_online on guild_members (is_online);

-- Seed 12 tim: 1-4 top, 5-8 mid, 9-12 bot
insert into teams (position, lane)
select p,
  case when p <= 4 then 'top'::member_lane
       when p <= 8 then 'mid'::member_lane
       else 'bot'::member_lane end
from generate_series(1, 12) as p;

-- RLS: read publik (anon + authenticated), write hanya admin
alter table guild_members enable row level security;
alter table teams enable row level security;
alter table lineup_slots enable row level security;

create policy "read guild members" on guild_members
  for select to anon, authenticated using (true);

create policy "read teams" on teams
  for select to anon, authenticated using (true);

create policy "read lineup slots" on lineup_slots
  for select to anon, authenticated using (true);

create policy "admin writes guild members" on guild_members
  for all to authenticated
  using ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin');

create policy "admin writes teams" on teams
  for all to authenticated
  using ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin');

create policy "admin writes lineup slots" on lineup_slots
  for all to authenticated
  using ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin');
