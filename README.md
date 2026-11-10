# Legend Army Hub — Guild League Lineup Manager

Website publik untuk melihat lineup aktif Guild League (12 tim × 5 slot) + area admin
(import CSV member & menyusun lineup) — Next.js App Router + Supabase (Postgres + RLS + Auth).

PRD & rencana ticket: `.scratch/guild-league-lineup/spec.md`.

## Stack

| Bagian      | Teknologi                                              |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 16 (App Router, RSC, TypeScript)              |
| Styling     | Tailwind CSS v4 + shadcn/ui (style `radix-nova`)      |
| Data        | Supabase Postgres + RLS + Auth (email/password)       |
| Parsing CSV | papaparse (RFC4180, tahan BOM/CRLF)                   |
| Test        | Playwright (e2e + unit)                              |
| Deploy      | Netlify (`@netlify/plugin-nextjs`)                    |

## Environment variables

Salin `.env.example` → `.env.local` lalu isi:

| Variabel                     | Sifat        | Kegunaan                                  |
| ---------------------------- | ------------ | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | publik       | URL project Supabase                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publik    | Kunci publishable (`sb_publishable_…`) untuk baca data publik |
| `SUPABASE_SERVICE_ROLE_KEY`  | **server-only** | Seed admin & import CSV (bypass RLS)   |
| `ADMIN_EMAIL`                | server-only  | Akun admin hasil seed (spec §4.4)         |
| `ADMIN_PASSWORD`             | server-only  | Password akun admin hasil seed           |
| `TEST_MEMBER_EMAIL`          | server-only  | Akun **non-admin** untuk test e2e 403 (opsional) |
| `TEST_MEMBER_PASSWORD`       | server-only  | Password akun non-admin tersebut         |

> `SUPABASE_SERVICE_ROLE_KEY` **tidak boleh** diberi prefix `NEXT_PUBLIC_` dan tidak boleh
> masuk ke client bundle. Kunci ini melewati RLS sepenuhnya. `npm run check:leak` membuktikan
> kuncinya tidak ada di build output.

## Setup

```bash
npm install
cp .env.example .env.local   # isi nilainya
npm run dev                  # http://localhost:3000
```

Skema database dibuat lewat migrasi SQL di `supabase/migrations/`:

```bash
# via Supabase CLI
supabase db push
# atau tempel isi file migrasi ke SQL Editor di dashboard
```

Migrasi `20261110115957_init_lineup_schema.sql` membuat tabel `guild_members`, `teams`,
`lineup_slots`, mengaktifkan RLS, dan men-seed 12 tim (position 1–4 `top`, 5–8 `mid`,
9–12 `bot`).

Migrasi `20261110220000_import_members_rpc.sql` menambah fungsi Postgres
`import_members(jsonb)`: satu transaksi untuk import CSV (lihat di bawah).

## Import CSV member

Halaman `/admin/members` (area admin). Alurnya: pilih file → **Periksa** (pratinjau,
tidak mengubah data apa pun) → konfirmasi yang menyebut jumlah member yang akan
dihapus → laporan hasil import.

Aturan main (spec §4.3, US-1):

| Aturan | Perilaku |
| ------ | -------- |
| Header | 12 kolom wajib, urut bebas, nama dicocokkan case-insensitive + trim. Tidak cocok → **import ditolak utuh** (pesan menyebut kolom bermasalah), tidak ada data yang berubah. |
| BOM / CRLF | UTF-8 BOM di-strip, line ending LF/CRLF keduanya diterima. |
| Baris bermasalah | Ditolak **per baris** (nilai non-numerik, jumlah kolom ≠ 12, nama kosong, `Player` duplikat) — file lain tetap masuk. |
| Replace-all | Isi tabel member setelah import = persis isi CSV. Member lama yang tidak ada di CSV hilang. |
| Lineup | Slot lineup dipertahankan **by nama** (case-insensitive). Member yang tidak ada di CSV → slot kosong + namanya muncul di laporan. |
| Batas | File > 5 MB atau > 2000 baris data ditolak, ditegakkan di server (`src/lib/csv.ts` + `MAX_IMPORT_BYTES`). Browser juga mengecek ukuran file lebih dulu supaya admin dapat pesan jelas, bukan error platform. |

Penulisan data lewat fungsi Postgres `import_members()`: snapshot lineup → hapus member
lama → insert member baru → bangun ulang slot by nama, **satu transaksi**. Kalau satu
langkah gagal, semuanya dibatalkan — tidak pernah ada kondisi "member lama terhapus,
member baru tidak masuk". Fungsi ini `SECURITY INVOKER` + cek `app_metadata.role =
'admin'`, jadi RLS tetap berlaku dan akun non-admin tidak bisa memanggilnya.

> Dua jebakan yang sudah ditangani di migrasi: PostgREST menolak statement `DELETE`
> tanpa `WHERE` di dalam fungsi (`DELETE requires a WHERE clause`) — makanya
> `delete from guild_members where true;`; dan fungsi yang mengembalikan `jsonb` dipanggil
> lewat `supabase.rpc("import_members", { payload })`.

> Batas 5 MB mengikuti spec. Di Netlify (payload Lambda ±6 MB) file sebesar itu bisa
> ditolak platform sebelum sampai Next.js; file export guild normal jauh di bawah itu.

## Auth admin

Tidak ada pendaftaran: **seed admin adalah satu-satunya jalur pembuatan akun**.

```bash
npm run seed:admin          # butuh SUPABASE_SERVICE_ROLE_KEY + ADMIN_EMAIL + ADMIN_PASSWORD
```

Script itu membuat (atau memperbarui) akun admin dan menaruh role di
`app_metadata.role = 'admin'` — `app_metadata` di-set server, jadi user tidak bisa
mengeditnya sendiri. Kalau `TEST_MEMBER_EMAIL` + `TEST_MEMBER_PASSWORD` diisi, akun
non-admin ikut dibuat (dipakai test e2e 403).

Proteksi area admin berlapis:

| Lapis                       | Yang dijaga                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `src/proxy.ts`              | Gerbang `/admin/*`: anonim → **307** ke `/login`, non-admin → **403** |
| `src/app/admin/layout.tsx`  | Pengecekan role kedua (server-verified) untuk halaman & action  |
| RLS Postgres                | Write hanya untuk claim JWT `app_metadata.role = 'admin'`       |
| Build output                | Service-role key tidak boleh masuk bundle client                 |

Halaman login ada di `/login`, area admin di `/admin`.

## Perintah

| Perintah               | Fungsi                                          |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Server pengembangan                             |
| `npm run build`        | Build produksi                                  |
| `npm run typecheck`    | Cek tipe (`tsc --noEmit`)                       |
| `npm run lint`         | ESLint                                          |
| `npm test`             | Playwright: unit + e2e (`tests/`)               |
| `npm run seed:admin`   | Seed akun admin (+ akun non-admin test)         |
| `npm run check:leak`   | Pastikan service-role key tidak di build output |
| `npm run check:signup` | Pastikan endpoint signup Supabase tertutup      |

## Test RLS

`supabase/tests/rls_anon_write.sql` membuktikan role `anon` **dan** user login non-admin
tidak bisa menulis ke `guild_members`, `teams`, maupun `lineup_slots` (penolakan harus
ber-SQLSTATE `42501`), sementara admin boleh menulis dan baca tetap boleh untuk semua.
Tiap bagian dibungkus transaksi sendiri (`begin; … rollback;`) sehingga data asli tidak
pernah berubah. Jalankan lewat SQL Editor / psql.

`tests/rls.spec.ts` membuktikannya lagi di lapisan HTTP yang dipakai aplikasi
(PostgREST + publishable key): `POST`/`PATCH`/`DELETE` ditolak, `GET` tetap 200 — untuk
role `anon` maupun token asli user non-admin.

`tests/auth.spec.ts` membuktikan alur aplikasi: anonim → 307 ke halaman login, admin →
area admin (sesi bertahan setelah refresh), non-admin → 403, logout → `/admin` terkunci lagi.

## Test import CSV

`tests/csv.unit.spec.ts` (unit, tanpa database): BOM + CRLF, validasi header (kolom
wajib hilang / kolom tak dikenal / urutan bebas / case-insensitive), penolakan per baris
(non-numerik, jumlah kolom ≠ 12, nama kosong, `Player` duplikat), batas 2000 baris, file
bukan UTF-8, nama non-Latin & emoji, dan fixture `import.csv` → 148 diterima, 0 ditolak.

`tests/import-members.spec.ts` (e2e, memakai database dev): admin login → pratinjau →
konfirmasi → laporan; import `import.csv` (148 baris) → 148 diterima, 0 ditolak, selesai
< 5 detik (SC1), isi tabel member = persis isi CSV; header salah → ditolak tanpa mengubah
data; file > 5 MB → ditolak dengan pesan jelas; lineup 3 slot → import CSV tanpa 1 member →
2 slot tetap terisi, 1 kosong, dan namanya muncul di laporan (SC2); anonim tidak bisa
menyentuh form import.

> Test e2e import memakai database dev sungguhan dan sifatnya **replace-all** — isi
> `guild_members` setelah test = isi file yang terakhir diimpor.

## Catatan Next.js 16

`next.config.ts` memakai `cacheComponents: true` (default scaffold Next 16).
Halaman yang membaca data per-request (mis. lewat `cookies()`) opted-out dengan
`export const instant = false` — halaman tetap dirender segar di server setiap
kali dibuka (AC4.4).

**Penting — status HTTP di area admin.** Dengan Cache Components, shell statis dikirim
sebelum render selesai, jadi `redirect()`/`forbidden()` yang dipanggil saat request hanya
menghasilkan **200 + halaman error**, bukan 307/403. Karena itu gerbang `/admin/*` ada di
`src/proxy.ts` (Next 16 `proxy`, berjalan sebelum render): di sana redirect 307 dan
respons 403 bisa benar-benar dikirim. `forbidden()` di `src/lib/auth.ts` masih dipakai
sebagai pagar kedua untuk server action, dengan UI di `src/app/forbidden.tsx`.

`experimental.authInterrupts` diaktifkan supaya `forbidden()` dari `next/navigation`
tampil sebagai UI 403 (bukan exception generik).

## Catatan operasional

- **Signup Supabase sudah dimatikan** (`disable_signup=true`). Cek ulang dengan
  `npm run check:signup`; test e2e yang sama ikut memverifikasi tiap build.
- **Ganti password akun dev** (`admin@legendarmy.test` / `member@legendarmy.test`) dengan
  password production-worthy sebelum deploy, lalu jalankan `npm run seed:admin` lagi.
- **Putar service-role key** kalau pernah dibagikan (mis. di chat/issue). Kuncinya hanya
  perlu di environment server — `npm run check:leak` membuktikan kuncinya tidak masuk bundle.

## Struktur

```
src/app/(public)/page.tsx   Halaman lineup publik (RSC, read-only)
src/app/login/               Halaman login + server action login
src/app/admin/               Area terproteksi (layout = pager role)
src/app/admin/members/       Halaman import CSV member (pratinjau + laporan)
src/app/forbidden.tsx        UI 403 (fallback `forbidden()` dari server action)
src/proxy.ts                 Gerbang /admin/* (307 ke /login, 403 untuk non-admin)
src/lib/auth.ts              DAL: user login, cek role admin, guard server action
src/lib/csv.ts               Parser + validator CSV export guild (BOM/CRLF/header/baris)
src/lib/lineup.ts            Query lineup + pengelompokan per lane
src/lib/supabase/server.ts   Klien Supabase SSR (cookie-based)
scripts/                     Seed admin + cek kebocoran kunci + cek signup
supabase/migrations/         Skema, RLS, seed tim, RPC import
supabase/tests/              Uji RLS SQL
tests/                       Uji Playwright (e2e + unit)
```

## Deploy (Netlify)

Build command `npm run build`, publish dir default Next.js runtime (OpenNext,
`@netlify/plugin-nextjs` dipasang otomatis oleh Netlify — jangan di-pin di repo).
`SUPABASE_SERVICE_ROLE_KEY` hanya boleh di environment server.

### Runbook deploy

1. **Repo** — push branch produksi (`main`) ke GitHub, lalu hubungkan repo itu ke site
   Netlify baru (bukan project lama). Build otomatis jalan tiap push.
2. **Env var di Netlify** (Project configuration → Environment variables), scope
   Builds + Functions:

   | Variabel | Nilai |
   | -------- | ----- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | kunci publishable (`sb_publishable_…`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key — **server-only**, jangan `NEXT_PUBLIC_` |
   | `ADMIN_EMAIL` | email admin hasil seed |
   | `ADMIN_PASSWORD` | password admin hasil seed |
   | `TEST_MEMBER_EMAIL` / `TEST_MEMBER_PASSWORD` | opsional, akun non-admin untuk e2e 403 |

   Perubahan env var baru berlaku setelah **redeploy**. Setelah env terpasang, jalankan
   `npm run seed:admin` sekali dari mesin lokal (atau dari build hook sekali jalan) supaya
   akun admin ada di project produksi.
3. **Verifikasi build** — `npm run build && npm run check:leak`: service-role key tidak
   boleh muncul di `.next/static`.
4. **Verifikasi produksi** — buka domain Netlify: halaman lineup & member tampil,
   login admin, import CSV (lihat bagian *Import CSV member*), drag & drop lineup,
   import ulang mempertahankan lineup. Uji tulis `anon` lewat PostgREST memakai
   publishable key harus ditolak (RLS).
5. **Lighthouse mobile** — jalankan pada URL produksi untuk `/` dan `/members`:
   `npx lighthouse <url> --preset=perf --form-factor=mobile --only-categories=performance,accessibility --chrome-flags="--headless=new"`.
   Target: Performance ≥ 90, Accessibility ≥ 90, LCP < 2.0 dtk.

### Supabase free-tier ter-pause

Project free-tier di-pause setelah ±1 minggu tanpa aktivitas; situs akan error sampai
project dibangunkan.

1. Buka dashboard Supabase → pilih project → **Restore project** (atau `restore_project`
   lewat Supabase MCP). Proses wake butuh beberapa menit.
2. Tunggu status `ACTIVE_HEALTHY`, lalu buka domain produksi — URL dan key tidak berubah,
   jadi tidak perlu mengubah env var Netlify.
3. Kalau build/deploy terakhir gagal karena database tidur, trigger **Deploy** ulang di
   Netlify setelah project sehat.

Cegah pause dengan aktivitas berkala (mis. query ringan dari uptime monitor) atau upgrade
ke plan berbayar.
