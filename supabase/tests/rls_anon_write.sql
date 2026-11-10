-- Test RLS: role `anon` DAN user login non-admin harus DITOLAK saat
-- insert/update/delete ke ketiga tabel (`guild_members`, `teams`, `lineup_slots`),
-- dan role admin (claim JWT `app_metadata`) harus BERHASIL menulis.
--
-- Jalankan via MCP `execute_sql` (isi file ini) atau psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_anon_write.sql
--
-- Konvensi:
--   - "ditolak" = error SQLSTATE 42501 (insufficient_privilege / RLS policy).
--     Error lain (mis. 23505 unique / 23514 check) TIDAK dianggap penolakan
--     → exception itu sengaja dibiarkan menggagalkan script.
--   - INSERT yang harus ditolak diuji dengan `do $$ ... exception when
--     insufficient_privilege then null; end $$;`.
--   - UPDATE/DELETE yang harus ditolak diuji dengan `get diagnostics affected =
--     row_count` + pengecekan ulang nilai baris (RLS menyaring baris tanpa error).
--   - Tiap bagian yang menyimulasikan role berdiri sendiri:
--     `begin; <data uji>; set local role ...; <kasus>; reset role; rollback;`.
--     Data uji dibuat DI DALAM transaksi bagian tersebut, jadi hasil apa pun
--     (policy bocor atau tidak) tidak pernah mendarat di data nyata — dan
--     skrip tetap benar dijalankan lewat psql (autocommit) maupun runner yang
--     membungkus seluruh file dalam satu transaksi.
--   - Blok `do $$` yang gagal menghentikan script (GAGAL).
--   - Statement terakhir membuktikan data nyata tetap utuh.

-- ==========================================================================
-- Bagian 1 — role `anon`: tidak boleh menulis ke ketiga tabel.
-- ==========================================================================
begin;

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

set local role anon;

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

-- 3. DELETE teams harus ditolak: 0 baris terpengaruh, tim 12 masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from teams where position = 12;
  get diagnostics affected = row_count;
  select count(*) into sisa from teams where position = 12;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: anon DELETE teams berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

-- 4. INSERT lineup_slots harus ditolak.
do $$
begin
  insert into lineup_slots (team_position, slot_no, member_id)
  select 2, 1, id from guild_members where player_name = 'RLS Test Member';
  raise exception 'GAGAL: anon INSERT lineup_slots TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 5. UPDATE lineup_slots harus ditolak: 0 baris terpengaruh, slot_no tetap 1.
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

-- 6. DELETE lineup_slots harus ditolak: 0 baris terpengaruh, slot masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from lineup_slots where team_position = 1;
  get diagnostics affected = row_count;
  select count(*) into sisa from lineup_slots where team_position = 1;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: anon DELETE lineup_slots berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

-- 7. INSERT guild_members harus ditolak.
do $$
begin
  insert into guild_members (
    source_id, player_name, level, class_name, title, gender, guild_rank,
    gear_score, weekly, weekly_contribution, total_contribution, online_status, is_online
  ) values (
    999998, 'RLS Anon Member', 99, 'Royal Guard', 'Test', 'Male', 'CITIZEN',
    1, 1, 1, 1, 'Offline', false
  );
  raise exception 'GAGAL: anon INSERT guild_members TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 8. UPDATE guild_members harus ditolak: 0 baris terpengaruh, nama tetap sama.
do $$
declare
  affected integer;
  name_after text;
begin
  update guild_members set player_name = 'RLS Test Member (diubah)' where source_id = 999999;
  get diagnostics affected = row_count;
  select player_name into name_after from guild_members where source_id = 999999;
  if affected <> 0 or name_after is distinct from 'RLS Test Member' then
    raise exception 'GAGAL: anon UPDATE guild_members berhasil (rows=% nama=%)', affected, name_after;
  end if;
end $$;

-- 9. DELETE guild_members harus ditolak: 0 baris terpengaruh, member uji masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from guild_members where source_id = 999999;
  get diagnostics affected = row_count;
  select count(*) into sisa from guild_members where source_id = 999999;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: anon DELETE guild_members berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

-- 10. Baca tetap boleh untuk anon.
do $$
declare
  total integer;
begin
  select count(*) into total from teams;
  if total <> 12 then
    raise exception 'GAGAL: anon SELECT teams mengembalikan % baris (harus 12)', total;
  end if;
end $$;

-- 11. Bukti penolakan (snapshot sebelum rollback): 12 tim, lane 4/4/4,
--     slot_no tim 1 tetap 1, member uji masih ada.
select
  (select count(*) from teams) as teams_total,
  (select count(*) from teams where lane = 'top') as teams_top,
  (select count(*) from teams where lane = 'mid') as teams_mid,
  (select count(*) from teams where lane = 'bot') as teams_bot,
  (select slot_no from lineup_slots where team_position = 1) as test_slot_no,
  (select count(*) from guild_members where source_id = 999999) as test_member_present;

reset role;
rollback;

-- ==========================================================================
-- Bagian 2 — admin (claim JWT app_metadata.role = 'admin') BOLEH menulis.
-- ==========================================================================
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

-- ==========================================================================
-- Bagian 3 — user non-admin (claim app_metadata.role = 'member') DITOLAK di
--             ketiga tabel: INSERT harus error 42501, UPDATE/DELETE 0 baris.
-- ==========================================================================
begin;

-- Data uji (dibuat sebagai role owner, di dalam transaksi bagian ini).
insert into guild_members (
  source_id, player_name, level, class_name, title, gender, guild_rank,
  gear_score, weekly, weekly_contribution, total_contribution, online_status, is_online
) values (
  999999, 'RLS Test Member', 99, 'Royal Guard', 'Test', 'Male', 'CITIZEN',
  1, 1, 1, 1, 'Offline', false
);

insert into lineup_slots (team_position, slot_no, member_id)
select 1, 1, id from guild_members where player_name = 'RLS Test Member';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"member"},"sub":"00000000-0000-0000-0000-000000000000"}';

-- 12. INSERT teams harus ditolak.
do $$
begin
  insert into teams (position, lane) values (13, 'top');
  raise exception 'GAGAL: non-admin INSERT teams TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 13. UPDATE teams harus ditolak: 0 baris terpengaruh, lane tidak berubah.
do $$
declare
  affected integer;
  lane_after member_lane;
begin
  update teams set lane = 'bot' where position = 1;
  get diagnostics affected = row_count;
  select lane into lane_after from teams where position = 1;
  if affected <> 0 or lane_after is distinct from 'top'::member_lane then
    raise exception 'GAGAL: non-admin UPDATE teams berhasil (rows=% lane=%)', affected, lane_after;
  end if;
end $$;

-- 14. DELETE teams harus ditolak: 0 baris terpengaruh, tim 12 masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from teams where position = 12;
  get diagnostics affected = row_count;
  select count(*) into sisa from teams where position = 12;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: non-admin DELETE teams berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

-- 15. INSERT guild_members harus ditolak.
do $$
begin
  insert into guild_members (
    source_id, player_name, level, class_name, title, gender, guild_rank,
    gear_score, weekly, weekly_contribution, total_contribution, online_status, is_online
  ) values (
    999997, 'RLS Non-admin Member', 99, 'Royal Guard', 'Test', 'Male', 'CITIZEN',
    1, 1, 1, 1, 'Offline', false
  );
  raise exception 'GAGAL: non-admin INSERT guild_members TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 16. UPDATE guild_members harus ditolak: 0 baris terpengaruh, nama tetap sama.
do $$
declare
  affected integer;
  name_after text;
begin
  update guild_members set player_name = 'RLS Test Member (diubah)' where source_id = 999999;
  get diagnostics affected = row_count;
  select player_name into name_after from guild_members where source_id = 999999;
  if affected <> 0 or name_after is distinct from 'RLS Test Member' then
    raise exception 'GAGAL: non-admin UPDATE guild_members berhasil (rows=% nama=%)', affected, name_after;
  end if;
end $$;

-- 17. DELETE guild_members harus ditolak: 0 baris terpengaruh, member uji masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from guild_members where source_id = 999999;
  get diagnostics affected = row_count;
  select count(*) into sisa from guild_members where source_id = 999999;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: non-admin DELETE guild_members berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

-- 18. INSERT lineup_slots harus ditolak.
do $$
begin
  insert into lineup_slots (team_position, slot_no, member_id)
  select 2, 1, id from guild_members where player_name = 'RLS Test Member';
  raise exception 'GAGAL: non-admin INSERT lineup_slots TIDAK ditolak';
exception
  when insufficient_privilege then null;
end $$;

-- 19. UPDATE lineup_slots harus ditolak: 0 baris terpengaruh, slot_no tetap 1.
do $$
declare
  affected integer;
  slot_after smallint;
begin
  update lineup_slots set slot_no = 2 where team_position = 1;
  get diagnostics affected = row_count;
  select slot_no into slot_after from lineup_slots where team_position = 1;
  if affected <> 0 or slot_after is distinct from 1 then
    raise exception 'GAGAL: non-admin UPDATE lineup_slots berhasil (rows=% slot=%)', affected, slot_after;
  end if;
end $$;

-- 20. DELETE lineup_slots harus ditolak: 0 baris terpengaruh, slot masih ada.
do $$
declare
  affected integer;
  sisa integer;
begin
  delete from lineup_slots where team_position = 1;
  get diagnostics affected = row_count;
  select count(*) into sisa from lineup_slots where team_position = 1;
  if affected <> 0 or sisa <> 1 then
    raise exception 'GAGAL: non-admin DELETE lineup_slots berhasil (rows=% sisa=%)', affected, sisa;
  end if;
end $$;

reset role;
rollback;

-- ==========================================================================
-- Bagian 4 — ejaan claim lama (app_meta_data) harus TIDAK memberi akses. Ini
--             regresi yang pernah ada: claim itu tidak pernah ada di JWT Supabase.
-- ==========================================================================
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

-- ==========================================================================
-- Bukti akhir: data nyata tidak berubah dan tidak ada sisa data uji.
-- ==========================================================================
select
  (select count(*) from teams) as teams_total,
  (select count(*) from teams where lane = 'top') as teams_top,
  (select count(*) from teams where lane = 'mid') as teams_mid,
  (select count(*) from teams where lane = 'bot') as teams_bot,
  (select count(*) from guild_members where player_name = 'RLS Test Member') as test_member_present,
  (select count(*) from lineup_slots) as slots_total;
