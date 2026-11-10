# 07: Direktori member publik

**What to build:** Member guild (tanpa login) membuka `/members` untuk mencari siapa yang aktif: cari by nama, saring by rank guild / class / status online, urutkan by gear score dan kontribusi, dan langsung lihat siapa yang sudah punya slot lineup.

**Spec:** `.scratch/guild-league-lineup/spec.md` US-5

**Blocked by:** 04 — Editor lineup drag & drop

**Status:** needs-triage

- [x] Halaman `/members` publik menampilkan seluruh member dalam tabel: nama, class, rank guild, gear score, status online, weekly & total contribution.
- [x] Search nama (contains, case-insensitive), filter rank guild / class / status online, dan sort (gear score, weekly, weekly contribution, total contribution, nama asc/desc) dieksekusi di server lewat query terindeks — bukan menyaring 148 baris di browser.
- [x] Member yang punya slot lineup menampilkan badge "Lineup" + nama timnya.
- [x] Filter dan sort bertahan di URL (search params) sehingga halaman bisa di-share dan di-bookmark.
- [x] Halaman responsif di mobile dan LCP < 2.0 detik pada koneksi 4G mobile.
- [x] Test e2e: search + filter + sort menghasilkan baris yang benar, dan URL hasil filter bisa dibuka ulang dengan hasil sama.

## Comments

- (kosong)
