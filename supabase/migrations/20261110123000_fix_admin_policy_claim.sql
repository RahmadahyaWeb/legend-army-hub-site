-- Fix: Supabase menaruh role admin di claim JWT `app_metadata` (tanpa underscore
-- di tengah). Migrasi sebelumnya memakai `app_meta_data`, jadi policy write
-- selalu bernilai NULL -> tidak pernah true -> admin pun tidak bisa menulis.
-- Spec §4.4/§4.5 ikut dikoreksi.
--
-- Prefix "admin writes ..." dipertahankan agar diff tetap mudah dibaca.

drop policy "admin writes guild members" on guild_members;
drop policy "admin writes teams" on teams;
drop policy "admin writes lineup slots" on lineup_slots;

create policy "admin writes guild members" on guild_members
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin writes teams" on teams
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin writes lineup slots" on lineup_slots
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
