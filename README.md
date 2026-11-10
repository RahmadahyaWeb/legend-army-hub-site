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

> `SUPABASE_SERVICE_ROLE_KEY` **tidak boleh** diberi prefix `NEXT_PUBLIC_` dan tidak boleh
> masuk ke client bundle. Kunci ini melewati RLS sepenuhnya.

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

## Perintah

| Perintah             | Fungsi                                       |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Server pengembangan                          |
| `npm run build`      | Build produksi                               |
| `npm run typecheck`  | Cek tipe (`tsc --noEmit`)                    |
| `npm run lint`       | ESLint                                       |
| `npm test`           | Playwright: unit + e2e (`tests/`)            |

## Test RLS

`supabase/tests/rls_anon_write.sql` membuktikan role `anon` tidak bisa menulis ke
`teams` maupun `lineup_slots` (penolakan harus ber-SQLSTATE `42501`), sementara
baca tetap boleh. Jalankan lewat SQL Editor / psql.

`tests/rls.spec.ts` membuktikannya lagi di lapisan HTTP yang dipakai aplikasi
(PostgREST + anon key): `POST`/`PATCH`/`DELETE` ditolak, `GET` tetap 200.

## Catatan Next.js 16

`next.config.ts` memakai `cacheComponents: true` (default scaffold Next 16).
Halaman yang membaca data per-request (mis. lewat `cookies()`) opted-out dengan
`export const instant = false` — halaman tetap dirender segar di server setiap
kali dibuka (AC4.4).


## Struktur

```
src/app/(public)/page.tsx   Halaman lineup publik (RSC, read-only)
src/lib/lineup.ts           Query lineup + pengelompokan per lane
src/lib/supabase/server.ts  Klien Supabase SSR (cookie-based)
supabase/migrations/         Skema, RLS, seed tim
supabase/tests/              Uji RLS SQL
tests/                       Uji Playwright (e2e + unit)
```

## Deploy (Netlify)

Build command `npm run build`, publish dir default Next.js runtime. Set seluruh env var
di Netlify UI. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh di environment server.
