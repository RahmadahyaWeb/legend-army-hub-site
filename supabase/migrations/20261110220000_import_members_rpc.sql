-- Import CSV member: replace-all + relink lineup by nama (D5/D7, US-1).
-- Spec: .scratch/guild-league-lineup/spec.md §4.2, §4.3
--
-- Satu fungsi = satu transaksi: snapshot lineup -> hapus member lama -> insert
-- member baru -> bangun ulang slot lineup by nama. Kalau satu langkah gagal,
-- Postgres membatalkan semuanya, jadi tidak pernah ada kondisi "member lama
-- terhapus tapi member baru tidak masuk".
--
-- SECURITY INVOKER: RLS tetap berlaku di dalam fungsi. Pemanggil harus punya
-- sesi admin; cek role di bawah juga menolak kalau dipanggil tanpa JWT admin.

create or replace function public.import_members(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_dropped jsonb := '[]'::jsonb;
  v_deleted integer := 0;
  v_relinked integer := 0;
  v_slot record;
  v_member_id uuid;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'forbidden: import_members hanya untuk admin'
      using errcode = '42501';
  end if;

  select count(*) into v_deleted from guild_members;

  -- Snapshot lineup SEBELUM member dihapus (slot ikut terhapus oleh cascade).
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'team_position', s.team_position,
             'slot_no', s.slot_no,
             'player_name', m.player_name
           )),
           '[]'::jsonb
         )
    into v_snapshot
    from lineup_slots s
    join guild_members m on m.id = s.member_id;

  -- `where true` wajib: PostgREST menolak statement DELETE tanpa WHERE
  -- ("DELETE requires a WHERE clause"), termasuk di dalam fungsi.
  delete from guild_members where true;

  insert into guild_members (
    source_id, player_name, level, class_name, title, gender, guild_rank,
    gear_score, weekly, weekly_contribution, total_contribution,
    online_status, is_online
  )
  select
    nullif(m->>'source_id', '')::int,
    m->>'player_name',
    (m->>'level')::int,
    m->>'class_name',
    m->>'title',
    m->>'gender',
    m->>'guild_rank',
    (m->>'gear_score')::int,
    (m->>'weekly')::int,
    (m->>'weekly_contribution')::int,
    (m->>'total_contribution')::int,
    m->>'online_status',
    (m->>'online_status') = '[Online]'
  from jsonb_array_elements(payload) as m;

  -- Bangun ulang slot: cocokkan by nama, case-insensitive (AC1.7).
  for v_slot in
    select * from jsonb_to_recordset(v_snapshot)
      as x(team_position smallint, slot_no smallint, player_name text)
  loop
    select gm.id into v_member_id
      from guild_members gm
     where lower(gm.player_name) = lower(v_slot.player_name)
     limit 1;

    if v_member_id is null
       or exists (select 1 from lineup_slots s where s.member_id = v_member_id)
    then
      -- Nama member tidak ada di CSV (atau dua slot lama menunjuk nama yang
      -- sekarang sama) -> slot jadi kosong dan namanya dicatat di laporan.
      v_dropped := v_dropped || jsonb_build_object(
        'player_name', v_slot.player_name,
        'team_position', v_slot.team_position,
        'slot_no', v_slot.slot_no
      );
    else
      insert into lineup_slots (team_position, slot_no, member_id)
      values (v_slot.team_position, v_slot.slot_no, v_member_id);
      v_relinked := v_relinked + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'deleted', v_deleted,
    'imported', (select count(*) from guild_members),
    'relinked', v_relinked,
    'dropped', v_dropped
  );
end;
$$;

revoke execute on function public.import_members(jsonb) from anon;
grant execute on function public.import_members(jsonb) to authenticated;
