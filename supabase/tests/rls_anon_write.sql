-- Test RLS: role `anon` harus DITOLAK saat menulis ke tabel `teams` & `lineup_slots`,
-- dan role admin (claim JWT `app_metadata`) harus BERHASIL menulis.
--
-- Jalankan via MCP `execute_sql` (isi file ini) atau psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_anon_write.sql
--
-- Konvensi:
--   - "ditolak" = error SQLSTATE 42501 (insufficient_privilege / RLS policy).
--     Error lain (mis. 23505 unique / 23514 check) TIDAK dianggap penolakan
--     → exception itu sengaja dibiarkan menggagalkan script.
--   - Blok `do $$` yang gagal menghentikan script (GAGAL).
--   - Statement terakhir membuktikan data uji benar-benar dibersihkan.

-- Data uji: 1 member + 1 slot lineup (agar UPDATE/DELETE ke slot yang ada bisa diuji).
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

-- 5. DELETE lineup_slots harus ditolak: 0 baris terpengaruh, slot masih ada.
do $$
declare
  affected integer;
begin
  delete from lineup_slots where team_position = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'GAGAL: anon DELETE lineup_slots menghapus % baris', affected;
  end if;
end $$;

-- 6. Baca tetap boleh untuk anon.
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

-- 7. Bukti penolakan (snapshot sebelum data uji dihapus): 12 tim, lane 4/4/4,
--    slot_no tim 1 tetap 1, member uji masih ada.
select
  (select count(*) from teams) as teams_total,
  (select count(*) from teams where lane = 'top') as teams_top,
  (select count(*) from teams where lane = 'mid') as teams_mid,
  (select count(*) from teams where lane = 'bot') as teams_bot,
  (select slot_no from lineup_slots where team_position = 1) as test_slot_no;

-- 8. Admin (claim JWT app_metadata.role = 'admin') BOLEH menulis.
begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"},"sub":"00000000-0000-0000-0000-000000000000"}';
do $$
declare
  affected integer;
begin
  update teams set lane = lane where position = 1;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'GAGAL: admin (claim app_metadata) tidak boleh menulis (rows=%)', affected;
  end if;
end $$;
reset role;
rollback;

-- 9. User non-admin (claim app_metadata.role = 'member') tetap DITOLAK.
begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"member"},"sub":"00000000-0000-0000-0000-000000000000"}';
do $$
declare
  affected integer;
begin
  update teams set lane = lane where position = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'GAGAL: user non-admin boleh menulis (rows=%)', affected;
  end if;
end $$;
reset role;
rollback;

-- 10. Ejaan claim lama (app_meta_data) harus TIDAK memberi akses — ini regresi yang
--     pernah ada: claim itu tidak pernah ada di JWT Supabase.
begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_meta_data":{"role":"admin"},"sub":"00000000-0000-0000-0000-000000000000"}';
do $$
declare
  affected integer;
begin
  update teams set lane = lane where position = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'GAGAL: claim app_meta_data (ejaan lama) ikut memberi akses tulis';
  end if;
end $$;
reset role;
rollback;

-- Bersihkan data uji.
delete from lineup_slots where member_id = (select id from guild_members where player_name = 'RLS Test Member');
delete from guild_members where player_name = 'RLS Test Member';

-- 11. Bukti pembersihan: harus 0 member uji dan 0 slot, tim tetap utuh.
select
  (select count(*) from teams) as teams_total,
  (select count(*) from teams where lane = 'top') as teams_top,
  (select count(*) from teams where lane = 'mid') as teams_mid,
  (select count(*) from teams where lane = 'bot') as teams_bot,
  (select count(*) from guild_members where player_name = 'RLS Test Member') as test_member_present,
  (select count(*) from lineup_slots) as slots_total;
