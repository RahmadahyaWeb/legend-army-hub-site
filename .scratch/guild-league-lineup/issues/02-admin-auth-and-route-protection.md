# 02: Auth admin dan proteksi route

**What to build:** Guild manager dapat login dengan email + password yang di-seed dari environment, lalu masuk ke area admin. Anonirnvisitor diarahkan ke halaman login, dan user login yang bukan admin melihat 403 — area admin benar-benar terkunci di database, bukan hanya disembunyikan di UI.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.4, §4.5, US-6

**Blocked by:** 01 — Bootstrap app, skema, dan lineup kosong yang tampil publik

**Status:** ready-for-human

> Implementasi kode **selesai dan terverifikasi** (18 test hijau, dijalankan terhadap build
> produksi `next start`, bukan hanya dev server).
> Yang tersisa hanya **dua tindakan oleh owner** yang memang butuh kredensial/dashboard:
> menempelkan `SUPABASE_SERVICE_ROLE_KEY` ke `.env.local`, dan mematikan tombol signup
> di dashboard Supabase. Keduanya sudah punya runbook + skrip pemeriksa.

- [x] Script seed membuat user admin dari env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) dan memberi role admin di `app_metadata` (server-set, bukan `user_metadata`). — `scripts/seed-admin.mjs` (`npm run seed:admin`), idempotent, menolak jalan kalau env wajib kosong.
- [x] Halaman login memvalidasi kredensial lewat Supabase Auth; session bertahan setelah refresh halaman. — `/login` + server action `signInWithPassword`; cookie sesi ditulis klien SSR; e2e "sesi admin bertahan setelah halaman di-refresh" hijau.
- [x] Route `/admin/*` yang diakses anonim → redirect ke halaman login; user login tanpa role admin → 403 Forbidden. — gerbang di `src/proxy.ts`: anonim → **307** ke `/login?next=…`, non-admin → **403** (status HTTP, bukan 200 + halaman "maaf").
- [ ] Tidak ada UI registrasi maupun endpoint signup yang terbuka; satu-satunya jalur pembuatan akun adalah seed. — **separuh**: aplikasi tidak punya halaman/aksi signup (e2e: `/signup` → 404, tidak ada tombol/link daftar), tapi **endpoint signup milik Supabase masih terbuka** (`disable_signup=false`) dan itu setelan platform, bukan kode. Sisa: item owner #2 di bawah + `npm run check:signup`.
- [x] Policy write RLS berlaku untuk role admin dan menolak `anon` serta user non-admin pada insert/update/delete di ketiga tabel. — dibuktikan di SQL (claim JWT disimulasikan) dan di HTTP (token asli user non-admin).
- [x] Service-role key hanya terbaca di server; build output dicek tidak memuatkannya di bundle client. — `scripts/check-no-service-role-leak.mjs` (`npm run check:leak`); diuji positif dengan kunci palsu yang disisipkan ke `.next/static`.
- [x] Test SQL RLS: `anon` dan user non-admin ditolak pada ketiga tabel. — `supabase/tests/rls_anon_write.sql` (20 kasus) dijalankan terhadap DB project: semua lolos, data nyata tidak berubah.
- [x] Test e2e: admin berhasil login dan melihat area admin; user non-admin melihat 403; anonim melihat halaman login. — `tests/auth.spec.ts` (8 kasus, 1 `fixme` untuk toggle signup platform).

## Comments

### Yang dikerjakan

- **Seed admin** `scripts/seed-admin.mjs`: bikin/perbarui user lewat Supabase Admin API (service role), `app_metadata.role = 'admin'` (server-set). Kalau `TEST_MEMBER_EMAIL` + `TEST_MEMBER_PASSWORD` diisi, ikut membuat akun non-admin untuk test 403.
- **Gerbang area admin** `src/proxy.ts` (Next 16 `proxy`): membaca sesi dari cookie, memverifikasi klaim JWT lewat `supabase.auth.getClaims()` (tanda tangan + masa berlaku, JWKS di-cache), lalu:
  - tidak ada sesi → `NextResponse.redirect()` → **307** ke `/login?next=…`;
  - role bukan `admin` → respons **403** dengan halaman HTML mandiri;
  - admin → lanjut ke render.
  Pembacaan role terpusat di `src/lib/claims.ts` supaya proxy dan DAL tidak bisa berbedaafsirkan JWT yang sama.
- **App**: `src/lib/auth.ts` (DAL: `getAuthUser()` via `getClaims()`, `requireAdmin()` = pagar untuk server action, `safeRedirectPath()` anti open-redirect), `src/app/login/` (halaman + server action + form client `useActionState`), `src/app/admin/` (layout + halaman admin), `src/app/forbidden.tsx` (UI 403 fallback).
- **Test**: `npm test` = 18 hijau, 1 skipped. `tests/auth.spec.ts` (alur aplikasi), `tests/rls.spec.ts` (+2 kasus non-admin dengan token asli), `tests/lineup-page.spec.ts`, `tests/lineup.unit.spec.ts`. Semua dijalankan ulang terhadap **build produksi** (`npm start`), bukan hanya dev server.
- **Test SQL** `supabase/tests/rls_anon_write.sql`: tiap bagian dibungkus `begin; … rollback;` sendiri dan data uji dibuat **di dalam** transaksi bagian itu. Alasannya: kalau runner membungkus seluruh file dalam satu transaksi, `rollback` di tengah akan menghapus data uji sehingga kasus INSERT diam-diam jadi "lolos" (insert 0 baris tanpa error). Dengan struktur per-bagian, skrip benar baik dijalankan via psql (autocommit) maupun runner yang wrap satu transaksi.
- **Bukti jalur admin di database**: token admin hasil login berisi claim `app_metadata: {"role":"admin"}` → `PATCH /rest/v1/teams` dan `INSERT /rest/v1/guild_members` **berhasil** (bukan hanya lolos policy). Ini yang dipakai ticket 03/04: admin menulis lewat sesi (publishable key + cookie), service-role key tidak wajib untuk write biasa.
- **Anti-bocor kunci**: `src/` tidak pernah membaca `SUPABASE_SERVICE_ROLE_KEY`; kuncinya hanya dipakai di `scripts/seed-admin.mjs` (Node, server). `npm run build && npm run check:leak` → "OK: tidak ada SUPABASE_SERVICE_ROLE_KEY di .next".

### Temuan penting: status HTTP di produksi ≠ dev

Versi pertama (guard di layout + `redirect()`/`forbidden()`) **hijau di dev, rusak di produksi**:
dengan Cache Components, shell statis dikirim sebelum render selesai, sehingga interrupt saat
request hanya menghasilkan **200 + halaman `__next_error__`** — anonim tidak dapat 307 ke
`/login`, non-admin tidak dapat 403. Terbukti saat menjalankan build produksi (`next start`):
`/admin` untuk anonim → 200 (bukan 307), bukan admin → 200 (bukan 403).

Dokumentasi Next 16 menyatakan hal yang sama: *"A request-time check inside the page runs
after the shell is sent, even when the shell is empty and the route sets `instant = false`,
so the status remains 200"*, dan mitigation-nya: jalankan pengecekan **di Proxy**
sebelum render.

Solusi yang dipakai: gerbang pindah ke `src/proxy.ts` (Next 16 `proxy`). Pengecekan role di
layout tetap ada sebagai pagar kedua untuk server action. `experimental.authInterrupts`
(`forbidden()`) tetap dipakai untuk UI 403 di server action, bukan untuk status route.

### Keputusan / penyimpangan dari spec

1. **Akun dev dibuat lewat SQL, bukan lewat script seed.** `SUPABASE_SERVICE_ROLE_KEY` masih kosong (item owner #1), jadi `npm run seed:admin` belum bisa dijalankan. Supaya area admin tetap bisa diuji end-to-end, dua akun dev dibuat langsung di `auth.users` + `auth.identities` (password di-hash `crypt()`/`bf`, `app_metadata` = `{"role":"admin"}` / `{"role":"member"}`, `email_confirmed_at` diisi). Hasilnya identik dengan yang akan dihasilkan script seed. Email & password akun dev **tidak ditulis di file ini** — hanya ada di `.env.local` (tidak di-commit): `admin@legendarmy.test` dan `member@legendarmy.test`. Passwordnya sudah dirotasi sekali (versi awal sempat tertulis di file ticket ini, tidak pernah masuk commit). **Owner wajib mengganti passwordnya sebelum deploy.**
2. **Endpoint signup Supabase masih terbuka** (`disable_signup=false`) dan tidak bisa dimatikan lewat kode — itu setelan platform (Management API / dashboard). Yang bisa dikontrol aplikasi: tidak ada halaman signup, tidak ada `signUp()` di mana pun, tidak ada route handler signup. Sisa pekerjaan = owner mematikan "Enable sign-ups" (item owner #2), setelah itu `npm run check:signup` harus hijau dan test `fixme` di `tests/auth.spec.ts` bisa diaktifkan. Sampai itu selesai, SC7 belum terpenuhi sepenuhnya.
3. **`next` setelah login dibatasi path internal** (`safeRedirectPath`): menolak `//host`, path non-`/`, dan backslash (browser bisa menormalisasi `/\host` jadi `//host`).
4. **Halaman 403 punya dua bentuk**: respons 403 dari proxy memakai HTML mandiri (tanpa CSS/JS aplikasi, supaya body tidak bergantung pada asset), sedangkan `src/app/forbidden.tsx` dipakai kalau `forbidden()` dilempar dari server action (UI penuh di dalam app).
5. **Gerbang ada di proxy, bukan per-halaman**: `src/proxy.ts` matcher `/admin/:path*` → semua `/admin/*` (termasuk halaman ticket 03/04) terlindungi tanpa perlu mengingat aturan per file. Catatan untuk ticket berikutnya: **setiap server action yang menulis wajib memanggil `requireAdmin()`** — proxy hanya melindungi navigasi, bukan POST langsung ke action.

### Yang belum selesai (perlu owner)

1. **`SUPABASE_SERVICE_ROLE_KEY`** masih kosong di `.env.local` → `npm run seed:admin` belum bisa dijalankan. Ambil dari dashboard Supabase → Project Settings → API Keys → **Legacy API Keys → service_role** (atau **Secret keys** → `sb_secret_…`), lalu jalankan `npm run seed:admin` (idempotent, jadi aman dijalankan ulang). Setelah itu ganti password akun dev dengan password production-worthy.
2. **Matikan signup Supabase**: dashboard → Authentication → Sign In / Providers → Email → **Enable sign-ups = OFF**. Verifikasi: `npm run check:signup` (dan aktifkan test `fixme` di `tests/auth.spec.ts`).
