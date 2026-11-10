-- Test RLS: role `anon` harus DITOLAK saat menulis ke tabel `teams` & `lineup_slots`.
--
-- Jalankan via MCP `execute_sql` (isi file ini) atau psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_anon_write.sql
--
-- Konvensi:
--   - "ditolak" = error SQLSTATE 42501 (insufficient_privilege / RLS policy).
--     Error lain (mis. 23505 unique / 23514 check) TIDAK dianggap penolakan
--     → exception itu sengaja dibiarkan menggagalkan script.
--   - Blok `do $$` yang gagal akan menghentikan script (GAGAL).
--   - Statement terakhir memverifikasi state akhir sekaligus membersihkan data uji.

-- Data uji: 1 member + 1 slot lineup (agar UPDATE ke slot yang ada bisa diuji).
insert into guild_members (
  source_id, player_name, level, class_name, title, gender, guild_rank,
  gear_score, weekly, weekly_contribution, total_contribution, online_status, is_online
) values (
  999999, 'RLS Test Member', 99, 'Royal Guard', 'Test', 'Male', 'CITIZEN',
  1, 1, 1, 1, 'Offline', false
);

insert into lineup_slots (team_position, slot_no, member_id)
select 1, 1, id from guild_members where player_name = 'RLS Test Member';

set role anon;

-- 1. INSERT teams harus ditolak.
do $$
begin
  insert into teams (position, lane) values (13, 'top');
  raise exception 'GAGAL: anon INSERT teams TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 2. UPDATE teams harus ditolak: 0 baris terpengaruh, lane tidak berubah.
do $$
declare
  affected integer;
  lane_after member_lane;
begin
  update teams set lane = 'bot' where position = 1;
  get diagnostics affected = row_count;
  select lane into lane_after from teams where position = 1;
  if affected <> 0 or lane_after is distinct from 'top'::member_lane then
    raise exception 'GAGAL: anon UPDATE teams berhasil (rows=% lane=%)', affected, lane_after;
  end if;
end $$;

-- 3. INSERT lineup_slots harus ditolak.
do $$
begin
  insert into lineup_slots (team_position, slot_no, member_id)
  select 2, 1, id from guild_members where player_name = 'RLS Test Member';
  raise exception 'GAGAL: anon INSERT lineup_slots TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 4. UPDATE lineup_slots harus ditolak: 0 baris terpengaruh, slot_no tetap 1.
do $$
declare
  affected integer;
  slot_after smallint;
begin
  update lineup_slots set slot_no = 2 where team_position = 1;
  get diagnostics affected = row_count;
  select slot_no into slot_after from lineup_slots where team_position = 1;
  if affected <> 0 or slot_after is distinct from 1 then
    raise exception 'GAGAL: anon UPDATE lineup_slots berhasil (rows=% slot=%)', affected, slot_after;
  end if;
end $$;

-- 5. Baca tetap boleh untuk anon.
do $$
declare
  total integer;
begin
  select count(*) into total from teams;
  if total <> 12 then
    raise exception 'GAGAL: anon SELECT teams mengembalikan % baris (harus 12)', total;
  end if;
end $$;

reset role;

-- Bukti + bersih-bersih data uji (satu statement: sub-select melihat snapshot
-- sebelum DELETE, jadi slot_no masih terlihat utuh).
with cleanup as (
  delete from guild_members where player_name = 'RLS Test Member' returning id
)
select
  (select count(*) from teams) as teams_total,
  (select count(*) from teams where lane = 'top') as teams_top,
  (select count(*) from teams where lane = 'mid') as teams_mid,
  (select count(*) from teams where lane = 'bot') as teams_bot,
  (select count(*) from guild_members where player_name = 'RLS Test Member') as test_member_present,
  (select slot_no from lineup_slots where team_position = 1) as test_slot_no
from cleanup;
