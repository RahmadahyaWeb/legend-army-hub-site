# PRD — Legend Army Hub: Guild League Lineup Manager

| Field | Value |
|---|---|
| Status | Draft untuk review |
| Tanggal | 2026-11-10 |
| Owner | Guild Manager (Legend Army) |
| Repo | `legend-army-hub` |
| Spec path | `.scratch/guild-league-lineup/spec.md` |

## 0. Keputusan Discovery (hasil interview)

| # | Topik | Keputusan |
|---|---|---|
| D1 | Hak akses edit | Hanya **admin login** (Supabase Auth email/password). Publik = read-only. |
| D2 | Riwayat lineup | **Satu lineup aktif saja**, tanpa arsip mingguan/season. |
| D3 | Penyusunan lineup | **Manual drag & drop** (bukan auto-suggest). |
| D4 | Arti lane | **Label saja** per team (top/mid/bot). Tidak ada aturan komposisi/validasi. |
| D5 | Import CSV | **Replace semua data member** (bukan upsert). |
| D6 | Halaman | **Lineup (publik) + Member (publik) + area admin**. Tidak ada dashboard agregat. |
| D7 | Dampak import ke lineup | **Lineup dipertahankan by nama** (`Player`); slot yang member-nya hilang jadi kosong + notifikasi. |
| D8 | Akun admin | **Seed dari environment variable** saat setup. Tidak ada pendaftaran terbuka. |

> Catatan domain penting: kolom `Position` pada CSV berisi **rank guild** (WARLORD, PRESIDENT, COMMANDER, GENERAL, CAPTAIN, ELDER, SUB LEADER, VETERAN, CITIZEN) — **bukan** lane Ragnarok. Lane top/mid/bot adalah atribut **team**, di-set manager, terpisah dari data member.

---

## 1. Executive Summary

### Problem Statement

Manajemen lineup Guild League (12 tim × 5 member) saat ini manual: manager menyalin data member dari export CSV ke spreadsheet, menyusun komposisi tim secara manual, lalu|resultatnya tidak pernah bisa dilihat member guild lewat satu sumber yang sama. Proses ini lambat (puluhan menit per minggu), rawan salah tempur, dan tidak ada jejak siapa yang sudah masuk tim.

### Proposed Solution

Website statis-fisik sederhana ("Legend Army Hub") dengan dua bagian: **halaman publik** untuk melihat lineup aktif dan direktori member, dan **area admin** untuk meng-import CSV member lalu menyusun 12 tim × 5 slot secara drag & drop. Data disimpan di Supabase (Postgres + RLS + Auth), UI memakai Next.js App Router + shadcn/ui, dideploy ke Netlify.

### Success Criteria

| # | Kriteria (terukur) |
|---|---|
| SC1 | Import `import.csv` (148 baris) berhasil **148/148 baris**, selesai **< 5 detik**, tanpa write manual. |
| SC2 | Import ulang tidak menghapus lineup diam-diam: setiap slot yang kehilangan member (tidak ada di CSV baru) **wajib** muncul di laporan hasil import. |
| SC3 | Menyusun lineup 60 member via drag & drop selesai **< 60 detik**, tanpa reload halaman; tiap drop ter-persist **< 1 detik**. |
| SC4 | Halaman publik lineup (12 tim, 60 member) LCP **< 2.0 dtk** pada koneksi 4G mobile; Lighthouse Performance **≥ 90** dan Accessibility **≥ 90**. |
| SC5 | **0** operasi tulis berhasil dari role `anon` atau user non-admin (dibuktikan test RLS: insert/update/delete ditolak). |
| SC6 | Halaman Member: hasil pencarian/filter tampil **< 300 ms** untuk dataset 148 member. |
| SC7 | Tidak ada akun self-registration; satu-satunya jalur login adalah admin hasil seed. |

---

## 2. User Experience & Functionality

### 2.1 User Personas

| Persona | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Guild Manager** (1–3 orang) | Admin guild dengan rank tinggi (WARLORD/COMMANDER). | Import data member cepat, menyusun lineup cepat, melihat siapa yang belum dapat slot. |
| **Member Guild** (banyak) | Member biasa (CITIZEN/VETERAN). | Cek lineup aktif, tahu tim & lane-nya, cari info member lain. |
| **Pengamat** | Pengamat non-member yang membuka website. | Lihat lineup & member (read-only, tanpa login). |

### 2.2 User Stories & Acceptance Criteria

#### US-1 — Import data member dari CSV
**As a** Guild Manager, **I want to** meng-upload file CSV export guild, **so that** data member di website selalu sama dengan data in-game.

- **AC1.1** Admin meng-upload `.csv`; sistem memvalidasi 12 header wajib (`Id, Player, Lv., Class, Title, Gender, Position, Gear Score, Weekly, Weekly Contribution, Total Contribution, Online Status`). Header hilang/typo → import **ditolak utuh** dengan pesan menyebut header yang tidak cocok.
- **AC1.2** File dengan BOM UTF-8 dan line ending CRLF diterima (BOM di-strip, BOM tidak boleh muncul di nama kolom pertama).
- **AC1.3** Baris dengan nilai non-numerik pada kolom numerik (`Lv.`, `Gear Score`, `Weekly`, `Weekly Contribution`, `Total Contribution`) **ditolak per baris**, bukan menggagalkan seluruh import.
- **AC1.4** `Player` ganda dalam satu file → baris kedua ditolak dengan alasan "duplicate player name".
- **AC1.5** Import bersifat **replace-all**: setelah import, isi tabel member = persis isi CSV (member lama yang tidak ada di CSV hilang).
- **AC1.6** Setelah import, sistem menampilkan laporan: jumlah baris berhasil, jumlah baris ditolak **beserta nomor baris + alasannya**, dan daftar member yang **kehilangan slot lineup**.
- **AC1.7** Member yang namanya sama dengan member lama (case-insensitive) **tetap occupying slot yang sama** di lineup (D7).
- **AC1.8** Import > 2000 baris atau > 5 MB ditolak (limit ditegakkan di server, bukan hanya UI).

#### US-2 — Menyusun lineup 12 tim × 5 member
**As a** Guild Manager, **I want to** drag member dari pool ke slot tim, **so that** komposisi lineup cepat selesai.

- **AC2.1** Admin melihat **12 kartu tim**, masing-masing dengan **5 slot**, dan panel pool member berisi seluruh member guild.
- **AC2.2** Drop member ke slot terisi → slot tersebut **ditolak** (member hanya boleh satu tim).
- **AC2.3** Drop member ke tim yang sudah punya 5 member → slot sisanya tidak menerima penempatan baru.
- **AC2.4** Membuang member dari slot (drag keluar / tombol "keluarkan") → member kembali ke pool, slot kosong.
- **AC2.5** Setiap perubahan langsung tersimpan (server action) tanpa tombol "Simpan" dan tanpa reload halaman.
- **AC2.6** Member yang sedang dipakai tim lain **tidak muncul sebagai draggable** di pool (difilter), agar tidak ada konflik.
- **AC2.7** **Alternatif tanpa drag**: klik member di pool → klik slot (atau tekan Enter) untuk placing. Jalur ini wajib ada (dasar aksesibilitas & perangkat sentuh).

#### US-3 — Mengatur lane per team
**As a** Guild Manager, **I want to** menandai tiap tim dengan lane, **so that** pembagian top/mid/bot sesuai kebutuhan league.

- **AC3.1** Tiap tim punya label lane: `top` | `mid` | `bot`. Default: **4 tim top, 4 mid, 4 bot** (dibagi berurutan Team 1–4 top, 5–8 mid, 9–12 bot).
- **AC3.2** Manager dapat memindahkan lane sebuah tim kapan saja; jumlah tim per lane **tidak divalidasi** (5/4/3, 6/3/3, dsb. boleh) — lane bersifat label, bukan aturan.
- **AC3.3** Halaman lineup publik mengelompokkan tim per lane, dan menampilkan ringkasan jumlah tim per lane.
- **AC3.4** Lane **tidak** memengaruhi validasi lineup dan **tidak** memengaruhi siapa boleh masuk tim.

#### US-4 — Melihat lineup aktif (publik)
**As a** Member Guild, **I want to** melihat lineup aktif tanpa login, **so that** saya tahu tim dan lane saya.

- **AC4.1** Halaman `/` (publik, tanpa login) menampilkan 12 tim yang dikelompokkan per lane, lengkap dengan nama member, class, rank guild, dan gear score.
- **AC4.2** Slot kosong ditampilkan eksplisit sebagai "Kosong" (bukan disembunyikan) agar terlihat jelas lineup belum lengkap.
- **AC4.3** Halaman dapat diakses tanpa login; tidak ada data yang bocor lewat API yang tidak diizinkan RLS.
- **AC4.4** Perubahan lineup oleh admin **terlihat setelah refresh** (tidak ada realtime/websocket pada v1).

#### US-5 — Direktori member (publik)
**As a** Member Guild, **I want to** mencari dan menyaring daftar member, **so that** saya bisa cari siapa yang sedang aktif.

- **AC5.1** Halaman `/members` menampilkan seluruh member dalam tabel.
- **AC5.2** Filter: **search nama** (contains, case-insensitive), **rank guild**, **class**, **status online/offline**.
- **AC5.3** Sort: Gear Score, Weekly Contribution, Total Contribution, Weekly, nama (toggle asc/desc).
- **AC5.4** Member yang sedang punya slot lineup ditandai badge "Lineup" + nama timnya.
- **AC5.5** Filter dan sort dieksekusi di server (query terindeks), bukan memuat 148 baris ke browser lalu menyaring.

#### US-6 — Proteksi area admin
**As a** Guild Manager, **I want to** area admin terkunci, **so that** hanya pengelola resmi yang bisa mengubah lineup.

- **AC6.1** `/admin/*` mengarahkan user belum login ke halaman login; user login non-admin melihat **403 Forbidden**.
- **AC6.2** Email + password login via Supabase Auth; role admin disimpan di `app_meta_data.role = 'admin'` (server-set, tidak bisa diedit user).
- **AC6.3** Tidak ada form registrasi di UI maupun endpoint signup yang terbuka.
- **AC6.4** Write di database ditolak untuk `anon` dan user tanpa role admin (RLS), bukan hanya disembunyikan di UI.

### 2.3 Non-Goals (v1 — dilindungi timeline)

- Riwayat lineup (arsip mingguan/season) — D2.
- Auto-suggest / auto-fill lineup berdasarkan gear score atau kontribusi — D3.
- Aturan komposisi lane (mis. wajib 2 top per tim) atau validasi class per lane — D4.
- Login untuk member guild; hanya admin yang punya akun.
- CRUD manual member di UI (CSV = sumber kebenaran; edit = import ulang).
- Dashboard agregat (total gear score per lane, ranking kontributor, rata-rata tim).
- Export lineup ke CSV/JSON, import lineup (hanya import member).
- Realtime/websocket untuk penonton, push notification, integrasi Discord.
- Multi-guild / multi-season / multi-event dalam satu instalasi.
- Aplikasi mobile native (mobile web responsif).

---

## 3. AI System Requirements

**Tidak berlaku pada v1.** Tidak ada fitur AI di scope: penyusunan lineup deterministik (manual), pencarian/filter berbasis query SQL, dan import CSV berbasis parsing deterministik.

Evaluasi output AI tidak relevan; kualitas diukur lewat Acceptance Criteria di Section 2 dan rencana pengujian di Section 4.6. Jika fitur auto-suggest lineup ditambahkan di v2.0, bagian ini harus diisi ulang (kriteria evaluasi: presisi 60 member terpilih, sebaran class, explainability).

---

## 4. Technical Specifications

### 4.1 Arsitektur Overview

```
Browser (publik / admin)
   │  RSC page render + Server Actions (Next.js App Router)
   ▼
Netlify (Next.js runtime, @netlify/plugin-nextjs)
   │  server-only: SUPABASE_SERVICE_ROLE_KEY
   ▼
Supabase ── Auth (email/password, JWT app_meta_data.role)
        ── PostgREST + RLS  →  Postgres
```

Komponen:

| Komponen | Tanggung jawab |
|---|---|
| `app/(public)/page.tsx` | Halaman lineup aktif (RSC, read-only). |
| `app/(public)/members/page.tsx` | Direktori member (RSC + search params untuk filter/sort). |
| `app/admin/**` | Area terproteksi: editor lineup (`/admin/lineup`), import & member (`/admin/members`). |
| `app/login/page.tsx` | Login admin. |
| `app/actions/*.ts` | Server Actions: `importMembers`, `assignMember`, `unassignMember`, `setTeamLane`. |
| `lib/supabase/{server,client}.ts` | Klien Supabase (SSR + browser) via `@supabase/ssr`. |
| `lib/csv.ts` | Parser CSV + validator baris + normalisasi header (BOM, CRLF). |
| `lib/members.ts` | Query member (filter/sort) & query lineup. |
| `supabase/migrations/*.sql` | Skema + RLS + seed 12 tim. |

Library tambahan (justifikasi): `dnd-kit` (drag & drop accessible + touch), `papaparse` (parser CSV RFC4180-compliant, menangani quote/newline di dalam field), `@supabase/ssr` (session berbasis cookie untuk App Router), `@netlify/plugin-nextjs` (deploy Next.js di Netlify). Tidak ada dependency lain di luar `next`, `react`, `tailwindcss`, shadcn/ui.

### 4.2 Model Data (Postgres)

```sql
create type member_lane as enum ('top', 'mid', 'bot');

-- Member guild (bukan user aplikasi)
create table guild_members (
  id                  uuid primary key default gen_random_uuid(),
  source_id           integer,                 -- kolom "Id" dari CSV (informational)
  player_name         text not null unique,    -- kolom "Player" = kunci identitas
  level               integer not null,        -- kolom "Lv."
  class_name          text not null,           -- kolom "Class"
  title               text not null,           -- kolom "Title"
  gender              text not null,           -- kolom "Gender"
  guild_rank          text not null,           -- kolom "Position" (WARLORD..CITIZEN)
  gear_score          integer not null,
  weekly              integer not null,
  weekly_contribution integer not null,
  total_contribution  integer not null,
  online_status       text not null,           -- raw, mis. "[Online]" / "Offline for 3 min"
  is_online           boolean not null,        -- derived: online_status = '[Online]'
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
```

Kontrak domain:

- `teams` = 12 baris seed (position 1–12), lane default `top` (1–4), `mid` (5–8), `bot` (9–12).
- `lineup_slots.member_id` UNIQUE → satu member maksimal satu tim (mencerminkan "12 tim × 5 member = 60 member unik").
- `ON DELETE CASCADE` + import replace-all → **snapshot lineup (team_position, slot_no, player_name) wajib diambil sebelum `DELETE FROM guild_members`**, lalu slot dibangun ulang dengan mencocokkan `player_name` (D7/AC1.7). Member yang tidak cocok → slot dikosongkan, namanya dicatat di laporan.

### 4.3 Kontrak CSV

- Encoding **UTF-8** (bom boleh ada → di-strip), delimiter `,`, header wajib **12 kolom** persis seperti di atas (urutan bebas, nama harus cocok setelah normalisasi: trim + case-insensitive).
- Ukuran maksimum **5 MB / 2000 baris** (divalidasi server-side).
- Baris kosong diabaikan; baris dengan jumlah kolom ≠ 12 ditolak per baris.
- Kolom `Position` = **rank guild**, disimpan ke `guild_rank`; **tidak** dipetakan ke lane.
- `Online Status` disimpan raw ke `online_status`; `is_online = (online_status = '[Online]')`.
- Nama dengan karakter non-Latin & emoji (mis. `ミLuuk丶Maw`, `Killuaツ`, `Bopi剥皮`) harus tampil utuh (UTF-8 end-to-end, tanpa escaping rusak).
- Sumber data = file export guild; tidak ada input CSV bebas di luar 12 kolom ini.

### 4.4 Integrasi Points

| Integrasi | Detail |
|---|---|
| Supabase Auth | Email/password. Role admin di `app_meta_data.role`; seeded lewat service-role admin API. |
| Supabase Postgres | Seluruh baca/tulis lewat PostgREST/Server Actions dengan session user (anon key), RLS aktif di semua tabel. |
| Netlify | Repo Git (GitHub `rahmadahya/legend-army-hub`) → build `npm run build`, publish otomatis via `@netlify/plugin-nextjs`. Env vars diset di Netlify UI. |
| Environment variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed script saja). |

Task setup yang membutuhkan persetujuan user (dijalankan saat implementasi, bukan sekarang):

1. **Buat Supabase project** via MCP `create_project` — tool mewajibkan pilihan organisasi & konfirmasi biaya → **user harus menentukan organisasi & menyetujui**. Free tier NOTE: project free-tier ter-pause setelah 1 minggu idle → build/seed ulang perlu re-awake.
2. **Seed admin** via script `scripts/seed-admin.mjs` (service role key) → membuat user + `app_meta_data.role = 'admin'`.
3. **Buat Netlify site** baru (project existing `treasure-by-me` tidak relevan) + set env vars + connect repo.

### 4.5 Security & Privacy

- **RLS aktif di `guild_members`, `teams`, `lineup_slots`.** Policy write hanya untuk `auth.jwt() -> 'app_meta_data' ->> 'role' = 'admin'`; policy read untuk `anon` + `authenticated`.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di environment server (server actions/seed script). **Tidak pernah** memakai prefix `NEXT_PUBLIC_` untuk key ini, tidak pernah di-expose ke client.
- Role admin di `app_meta_data` (server-set via admin API) — bukan `user_metadata` yang bisa diubah user sendiri.
- Tidak ada endpoint signup terbuka; seed admin = satu-satunya jalur pembuatan akun.
- Batas ukuran/row import divalidasi di server (5 MB / 2000 baris) untuk mencegah penyalahgunaan resource.
- Pratinjau import (isi file) hanya ditampilkan ke admin.
- Data yang dipublikasikan: nick, class, rank guild, gear score, status online, kontribusi. Tidak ada data pribadi (nama asli/email/telepon) yang masuk CSV.
- Log server tidak boleh mencetak isi CSV penuh atau credential.

### 4.6 Rencana Pengujian & Verifikasi

| Area | Uji | Cara |
|---|---|---|
| Import | 148 baris valid → 148 tersimpan, 0 ditolak | Test integrasi: seed CSV fixture → jalankan parser+validator → assert. |
| Import | BOM + CRLF, baris dengan kolom kosong & value non-numerik, `Player` duplikat | Unit test parser: header, BOM strip, per-row skip + alasan. |
| Import | Lineup dipertahankan by nama | Fixture: lineup 3 slot → import CSV tanpa 1 member → assert 2 slot terisi, 1 kosong + 1 nama tercatat di laporan. |
| Lineup | Constraint slot & duplikasi | Test server action: assign member yang sudah punya tim → error; assign ke tim penuh → error. |
| RLS | anon & user non-admin tidak bisa write | SQL test: `set role anon; insert into lineup_slots ...` → harus error; `update teams set lane ...` → harus error. |
| UI publik | Lineup tampil 12 tim/60 slot, slot kosong terlihat | E2E (Playwright): buka `/` tanpa login → assert 12 kartu tim, badge "Kosong" ada. |
| Aksesibilitas | Jalur assign tanpa drag tersedia & fokus keyboard | E2E: pilih member via keyboard → klik slot → lineup terisi. |
| Performa | LCP & Lighthouse | Lighthouse CI (mobile preset): Performance ≥ 90, Accessibility ≥ 90, LCP < 2.0 dtk. |
| Integrasi | Deploy produksi | `netlify deploy`/deploy preview → cek halaman lineup & admin login pada domain produksi. |

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

**MVP (v1.0) — target utama:**

1. Scaffold Next.js + TS + Tailwind + shadcn/ui; setup env & Supabase project.
2. Skema Postgres + RLS + seed 12 tim.
3. Auth admin (seed + login + proteksi route admin).
4. Import CSV (parser, validator, replace-all, relink lineup by nama, laporan).
5. Editor lineup (drag & drop dnd-kit + jalur klik/keyboard).
6. Pengaturan lane per team + ringkasan distribusi lane.
7. Halaman publik lineup + direktori member (filter/sort server-side).
8. Deploy Netlify + verifikasi produksi ( checklist Section 4.6).

**v1.1 — setelah MVP dipakai ≥ 2 siklus league:**

- Export lineup ke CSV & snapshot arsip lineup (mulai muncul kebutuhan "composition minggu lalu").
- Edit member manual per-field (tanpa import ulang).
- Filter multi-lane / filter "hanya yang punya slot" di direktori member.
- Sorting & grouping member per lane.

**v2.0 — ekspansi:**

- Auto-suggest lineup 60 member (rank by gear score + kontribusi) dengan preview sebelum dipakai.
- Multi-season / multi-event, arsip lineup per periode.
- Integrasi Discord (notifikasi lineup rilis, reminder).
- Saran lane per class (High Priest→support, Alithea→mid, dst.) sebagai *saran*, bukan aturan.

### 5.2 Technical Risks

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Import replace-all menghapus member yang tidak ada di CSV | Data hilang | Snapshot+relink by nama (AC1.7); laporan slot kosong wajib tampil (SC2); konfirmasi dialog sebelum import ("N member akan dihapus"). |
| R2 | Format CSV export berubah (header/kolom) | Import gagal total | Validasi 12 header dengan pesan spesifik; simpan `docs/import-template.csv` sebagai kontrak; file contoh valid dipakai test. |
| R3 | Drag & drop poor experience di mobile | Sulit dipakai HP | Jalur klik→slot sebagai fitur wajib (AC2.7), bukan fallback opsional. |
| R4 | `SUPABASE_SERVICE_ROLE_KEY` bocor ke client | Bypass RLS total | Hanya env server; tidak pernah `NEXT_PUBLIC_`; review sebelum deploy. |
| R5 | Supabase free-tier project ter-pause idle | Situs error setelah lama idle | Dingatkan di README/runbook; re-wake butuh beberapa menit. |
| R6 | Netlify: proses build lama / image besar | Deploy lambat, biaya | `next build` standar + cache dependency Netlify; hindari library berat. |
| R7 | Query filter member melambat saat data tumbuh | Halaman lambat (AC5.5) | Query terindeks + `ILIKE` pada `player_name`; pagination/limit bila data > 500 baris. |
| R8 | Race saat 2 admin drag bersamaan | Slot bentrok | Constraint DB (`primary key (team_position, slot_no)`, `unique(member_id)`) sebagai sumber kebenaran; server action mengembalikan error → UI refresh. |
| R9 | Live preview halaman publik masih data lama | Member salah info | `revalidatePath('/')` setelah mutasi admin; tetap tanpa realtime (AC4.4). |
