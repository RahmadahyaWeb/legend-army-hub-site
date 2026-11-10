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

## Yang masih perlu tindakan owner

1. **Signup Supabase masih terbuka.** Di dashboard: Authentication → Sign In / Providers →
   Email → **Enable sign-ups = OFF**. Setelah itu `npm run check:signup` harus hijau.

## Struktur

```
src/app/(public)/page.tsx   Halaman lineup publik (RSC, read-only)
src/app/login/               Halaman login + server action login
src/app/admin/               Area terproteksi (layout = pager role)
src/app/forbidden.tsx        UI 403 (fallback `forbidden()` dari server action)
src/proxy.ts                 Gerbang /admin/* (307 ke /login, 403 untuk non-admin)
src/lib/auth.ts              DAL: user login, cek role admin, guard server action
src/lib/lineup.ts            Query lineup + pengelompokan per lane
src/lib/supabase/server.ts   Klien Supabase SSR (cookie-based)
scripts/                     Seed admin + cek kebocoran kunci + cek signup
supabase/migrations/         Skema, RLS, seed tim
supabase/tests/              Uji RLS SQL
tests/                       Uji Playwright (e2e + unit)
```

## Deploy (Netlify)

Build command `npm run build`, publish dir default Next.js runtime. Set seluruh env var
di Netlify UI. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh di environment server.
