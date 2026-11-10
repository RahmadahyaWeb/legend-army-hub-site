# 01: Bootstrap app, skema, dan lineup kosong yang tampil publik

**What to build:** Aplikasi Next.js + Supabase yang benar-benar berjalan, sehingga siapa pun yang membuka website langsung melihat 12 tim Guild League (default 4 top / 4 mid / 4 bot) dengan 5 slot "Kosong" di setiap tim. Ini jalur vertikal pertama: skema → query → halaman publik.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.1, §4.2, §4.5

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Next.js (App Router, TypeScript, Tailwind, shadcn/ui) ter-scaffold di repo; `npm run dev` dan `npm run build` berjalan tanpa error.
- [ ] Supabase project dibuat (organisasi & persetujuan biaya sudah dikonfirmasi user); URL, anon key, dan service-role key tersedia sebagai env var, service-role hanya di environment server. — **terpenuhi sebagian**: project `legend-army-hub` (ref `ugrldjoimmaqmcfkihlv`, region ap-southeast-1, biaya $0) + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sudah terisi di `.env.local`; `SUPABASE_SERVICE_ROLE_KEY` masih kosong — menunggu owner menempelkan nilainya dari dashboard (server-only, tanpa prefix `NEXT_PUBLIC_`).
- [x] Migrasi SQL membuat tabel member, tim, dan slot lineup beserta index, sesuai model data di spec §4.2 (nama kolom boleh berubah, tapi relasi dan aturan slot — 12 tim, 5 slot per tim, 1 member per slot, 1 tim per member — harus sama).
- [x] RLS aktif di ketiga tabel: policy select untuk `anon` + `authenticated`; policy write hanya untuk role admin (penetapan role menyusul di ticket 02, sementara ini write ditolak untuk semua role).
- [x] Tabel tim ter-seed 12 baris dengan lane default 4 top, 4 mid, 4 bot.
- [x] Halaman publik `/` menampilkan 12 tim yang dikelompokkan per lane, tiap tim punya 5 slot berlabel "Kosong".
- [x] Audit checklist shadcn dijalankan; tidak ada item gagal.
- [x] Test SQL RLS: `set role anon` → insert/update pada tabel tim & slot lineup harus ditolak.
- [x] Test e2e: buka `/` tanpa login → 12 kartu tim tampil dan badge "Kosong" terlihat.

## Comments

### Yang dikerjakan

- **Supabase project**: `legend-army-hub`, ref `ugrldjoimmaqmcfkihlv`, region `ap-southeast-1`, biaya $0/bulan (organisasi `RahmadahyaWeb's Org`).
- **Migrasi** `supabase/migrations/20261110115957_init_lineup_schema.sql` (sudah diterapkan ke project):
  `guild_members` / `teams` / `lineup_slots` + index `idx_members_gear_score`, `idx_members_rank_class`, `idx_members_online`; seed 12 tim (position 1–4 `top`, 5–8 `mid`, 9–12 `bot`).
  Relasi dijaga constraint DB: `lineup_slots.member_id` UNIQUE (1 member = 1 tim), PK `(team_position, slot_no)` + `check (slot_no between 1 and 5)`, FK `teams(position)` ON DELETE CASCADE.
- **RLS** aktif di ketiga tabel. Select: policy untuk `anon` + `authenticated`. Write: policy `admin writes …` dengan syarat `(auth.jwt() -> 'app_meta_data' ->> 'role') = 'admin'`. Belum ada admin yang di-seed (ticket 02), jadi secara efektif write ditolak untuk semua role saat ini.
- **App**: Next.js 16.4.6 (App Router, TS, Tailwind v4, shadcn/ui `radix-nova`), React 19. Halaman publik `src/app/(public)/page.tsx` (server component) + `src/lib/lineup.ts` (query lineup + `groupByLane`) + `src/lib/supabase/server.ts` (klien SSR).
- **Test**: `npm test` (Playwright) = 7/7 hijau — 2 unit (`groupByLane`), 4 RLS HTTP (`tests/rls.spec.ts`), 1 e2e halaman publik (`tests/lineup-page.spec.ts`: 12 kartu tim, 60 badge "Kosong", 3 kelompok lane).
- **Test RLS SQL**: `supabase/tests/rls_anon_write.sql` — dijalankan terhadap DB project, semua assert lolos (penolakan SQLSTATE `42501`, baca tetap boleh).
- **Bukti RLS di lapisan HTTP** (yang dipakai aplikasi): `POST /rest/v1/teams` → 401 `42501`; `PATCH`/`DELETE /rest/v1/teams` → 0 baris terpengaruh; `POST /rest/v1/lineup_slots` → 401 `42501`; `GET /rest/v1/teams` → 200 (12 baris).
- **Audit checklist shadcn**: import component benar (typecheck 0 error), tidak ada `next/image` sehingga `remotePatterns` tidak perlu, semua dependency terinstal, lint 0 error/warning, typecheck 0 error, sudah diverifikasi di browser (390px & 1280px).
- `npm run build` sukses; `/` ditandai `ƒ (Dynamic) server-rendered on demand` (AC4.4: perubahan admin terlihat setelah refresh).

### Keputusan / penyimpangan dari spec

1. **Kunci publishable, bukan legacy anon key.** Env var diganti `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nilai `sb_publishable_…`), sesuai rekomendasi Supabase untuk project baru. `sb_publishable_…` bukan JWT, jadi tidak boleh dipanggil "anon key"; spec §4.4 sudah disesuaikan. Sudah diuji: baca 200, write tetap 42501, endpoint auth password grant menerima key (400 `invalid_credentials`, bukan error token).
2. **`export const instant = false`** pada halaman publik. `next.config.ts` memakai `cacheComponents: true` (default scaffold Next 16) sehingga route yang baca `cookies()` diblokir saat prerender. Opt-out ini membuat halaman tetap dirender segar di server tiap request — persis AC4.4 — tanpa memakai `use cache`/`Suspense`.
3. **Types database di-generate** (`src/lib/supabase/database.types.ts`) dan Klien Supabase di-typed dengan `Database`. Ini menghapus unsafe cast pada embed `lineup_slots → guild_members` dan membuat `isOneToOne` (embed jadi objek, bukan array) terjamin oleh tipe.
4. **Tidak ada dependency baru di luar daftar spec**: hanya `next`, `react`, `tailwindcss`, shadcn/ui, plus `@supabase/supabase-js` + `@supabase/ssr` (wajib) dan `@playwright/test` (e2e, wajib §4.6). `dnd-kit` dan `papaparse` **tidak** dipasang — dipakai ticket 04 & 03.

### Yang belum selesai

- `SUPABASE_SERVICE_ROLE_KEY` masih kosong di `.env.local`. Dibutuhkan untuk ticket 02 (seed admin: `app_meta_data.role = 'admin'`) dan ticket 03 (import CSV replace-all, yang harus lewat service role agar tidak bergantung sesi login). Nilai diambil dari dashboard Supabase → Project Settings → API Keys → **Legacy API Keys → service_role** (atau **Secret keys** → `sb_secret_…`), lalu menempel di sini. Kunci hanya boleh dipakai di environment server — jangan pernah diberi prefix `NEXT_PUBLIC_`.
