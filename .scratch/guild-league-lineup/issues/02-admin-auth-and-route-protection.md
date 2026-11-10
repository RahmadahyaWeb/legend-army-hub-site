# 02: Auth admin dan proteksi route

**What to build:** Guild manager dapat login dengan email + password yang di-seed dari environment, lalu masuk ke area admin. Anonirnvisitor diarahkan ke halaman login, dan user login yang bukan admin melihat 403 — area admin benar-benar terkunci di database, bukan hanya disembunyikan di UI.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.4, §4.5, US-6

**Blocked by:** 01 — Bootstrap app, skema, dan lineup kosong yang tampil publik

**Status:** ready-for-agent

- [ ] Script seed membuat user admin dari env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) dan memberi role admin di `app_meta_data` (server-set, bukan `user_metadata`).
- [ ] Halaman login memvalidasi kredensial lewat Supabase Auth; session bertahan setelah refresh halaman.
- [ ] Route `/admin/*` yang diakses anonim → redirect ke halaman login; user login tanpa role admin → 403 Forbidden.
- [ ] Tidak ada UI registrasi maupun endpoint signup yang terbuka; satu-satunya jalur pembuatan akun adalah seed.
- [ ] Policy write RLS berlaku untuk role admin dan menolak `anon` serta user non-admin pada insert/update/delete di ketiga tabel.
- [ ] Service-role key hanya terbaca di server; build output dicek tidak memuatkannya di bundle client.
- [ ] Test SQL RLS: `anon` dan user non-admin ditolak pada ketiga tabel.
- [ ] Test e2e: admin berhasil login dan melihat area admin; user non-admin melihat 403; anonim melihat halaman login.

## Comments

- (kosong)
