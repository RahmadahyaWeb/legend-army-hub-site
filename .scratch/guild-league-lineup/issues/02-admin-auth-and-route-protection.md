# 02: Auth admin dan proteksi route

**What to build:** Guild manager dapat login dengan email + password yang di-seed dari environment, lalu masuk ke area admin. Anonirnvisitor diarahkan ke halaman login, dan user login yang bukan admin melihat 403 — area admin benar-benar terkunci di database, bukan hanya disembunyikan di UI.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.4, §4.5, US-6

**Blocked by:** 01 — Bootstrap app, skema, dan lineup kosong yang tampil publik

**Status:** needs-triage

> Implementasi kode **selesai dan terverifikasi** (19 test hijau, dijalankan terhadap build
> produksi `next start`, bukan hanya dev server).
> Semua item owner sudah beres: service-role key diisi + `npm run seed:admin` jalan, dan signup
> Supabase sudah dimatikan (`disable_signup=true`, endpoint balas `422 signup_disabled`).
> Tidak ada lagi yang menunggu manusia — ticket dikembalikan ke maintainer untuk ditutup.

- [x] Script seed membuat user admin dari env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) dan memberi role admin di `app_metadata` (server-set, bukan `user_metadata`). — `scripts/seed-admin.mjs` (`npm run seed:admin`), idempotent, menolak jalan kalau env wajib kosong.
- [x] Halaman login memvalidasi kredensial lewat Supabase Auth; session bertahan setelah refresh halaman. — `/login` + server action `signInWithPassword`; cookie sesi ditulis klien SSR; e2e "sesi admin bertahan setelah halaman di-refresh" hijau.
- [x] Route `/admin/*` yang diakses anonim → redirect ke halaman login; user login tanpa role admin → 403 Forbidden. — gerbang di `src/proxy.ts`: anonim → **307** ke `/login?next=…`, non-admin → **403** (status HTTP, bukan 200 + halaman "maaf").
- [x] Tidak ada UI registrasi maupun endpoint signup yang terbuka; satu-satunya jalur pembuatan akun adalah seed. — aplikasi tidak punya halaman/aksi signup (e2e: `/signup` → 404, tidak ada tombol/link daftar), dan **endpoint signup Supabase sudah dimatikan** (`disable_signup=true`; percobaan signup → `422 signup_disabled`, 0 user baru dibuat). Test e2e `endpoint signup Supabase sudah ditutup` aktif dan hijau; `npm run check:signup` hijau.
- [x] Policy write RLS berlaku untuk role admin dan menolak `anon` serta user non-admin pada insert/update/delete di ketiga tabel. — dibuktikan di SQL (claim JWT disimulasikan) dan di HTTP (token asli user non-admin).
- [x] Service-role key hanya terbaca di server; build output dicek tidak memuatkannya di bundle client. — `scripts/check-no-service-role-leak.mjs` (`npm run check:leak`); diuji positif dengan kunci palsu yang disisipkan ke `.next/static`.
- [x] Test SQL RLS: `anon` dan user non-admin ditolak pada ketiga tabel. — `supabase/tests/rls_anon_write.sql` (20 kasus) dijalankan terhadap DB project: semua lolos, data nyata tidak berubah.
- [x] Test e2e: admin berhasil login dan melihat area admin; user non-admin melihat 403; anonim melihat halaman login. — `tests/auth.spec.ts` (8 kasus, 0 skipped; incl. assert signup platform tertutup).

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

1. **Akun dev awalnya dibuat lewat SQL** (saat service-role key belum ada), lalu **di-seed ulang lewat jalur resmi** `npm run seed:admin` setelah owner menempelkan `SUPABASE_SERVICE_ROLE_KEY` → hasilnya: `app_metadata` = `{"role":"admin"}` / `{"role":"member"}`, `user_metadata` hanya berisi `email_verified` (role TIDAK pernah ada di `user_metadata`), email terverifikasi. Jalur seed resmi sudah terbukti idempotent (user ada → "diperbarui"). Email & password akun dev **tidak ditulis di file ini** — hanya ada di `.env.local` (tidak di-commit): `admin@legendarmy.test` dan `member@legendarmy.test`. Passwordnya sudah dirotasi sekali (versi awal sempat tertulis di file ticket ini, tidak pernah masuk commit). **Owner wajib mengganti passwordnya sebelum deploy.**
2. **Endpoint signup Supabase** tidak bisa dimatikan lewat kode (setelan platform) → dimatikan manual oleh owner di dashboard (Authentication → Sign In / Providers → Email → Enable sign-ups = OFF). Sekarang: `disable_signup=true`, `npm run check:signup` hijau, dan percobaan signup ditolak `422 signup_disabled`. Sisi aplikasi juga bersih: tidak ada halaman signup, tidak ada `signUp()` di mana pun, tidak ada route handler signup. **SC7 terpenuhi.**
3. **`next` setelah login dibatasi path internal** (`safeRedirectPath`): menolak `//host`, path non-`/`, dan backslash (browser bisa menormalisasi `/\host` jadi `//host`).
4. **Halaman 403 punya dua bentuk**: respons 403 dari proxy memakai HTML mandiri (tanpa CSS/JS aplikasi, supaya body tidak bergantung pada asset), sedangkan `src/app/forbidden.tsx` dipakai kalau `forbidden()` dilempar dari server action (UI penuh di dalam app).
5. **Gerbang ada di proxy, bukan per-halaman**: `src/proxy.ts` matcher `/admin/:path*` → semua `/admin/*` (termasuk halaman ticket 03/04) terlindungi tanpa perlu mengingat aturan per file. Catatan untuk ticket berikutnya: **setiap server action yang menulis wajib memanggil `requireAdmin()`** — proxy hanya melindungi navigasi, bukan POST langsung ke action.

### Yang belum selesai

Tidak ada. Semua item owner beres (service-role key + seed resmi jalan, signup dimatikan).

Sisa catatan operasional: ganti password akun dev `admin@legendarmy.test` / `member@legendarmy.test`
dengan password production-worthy sebelum deploy, dan putar (rotasi) service-role key kalau
transkrip sesi tempat kuncinya dibagikan — `npm run seed:admin` idempotent, jadi aman dijalankan ulang.

> Catatan: `SUPABASE_SERVICE_ROLE_KEY` sempat ditulis di dalam sesi chat saat owner menyerahkannya. Kalau transkrip sesi itu dibagikan, rotasi kunci di dashboard Supabase (Legacy API Keys → service_role) lalu tempel ulang ke `.env.local` dan jalankan `npm run seed:admin` lagi (idempotent).
