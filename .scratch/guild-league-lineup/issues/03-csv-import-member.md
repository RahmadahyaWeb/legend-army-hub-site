# 03: Import CSV member

**What to build:** Guild manager meng-upload file CSV export guild dari area admin; website memuat seluruh member dari file itu (replace-all), menolak baris bermasalah tanpa menggagalkan import, dan menampilkan laporan apa yang masuk dan apa yang ditolak beserta alasannya.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.3, US-1

**Blocked by:** 02 — Auth admin dan proteksi route

**Status:** ready-for-agent

- [ ] Form upload CSV di area admin; file > 5 MB atau > 2000 baris ditolak dengan pesan jelas.
- [ ] Header divalidasi terhadap 12 kolom wajib (urutan bebas, pencocokan nama case-insensitive + trim); file dengan BOM UTF-8 dan line ending CRLF diterima, BOM tidak ikut jadi nama kolom pertama.
- [ ] Header tidak cocok → import ditolak utuh dengan pesan menyebut kolom yang bermasalah; tidak ada data yang berubah.
- [ ] Baris dengan nilai non-numerik pada kolom numerik ditolak **per baris** (bukan menggagalkan seluruh file), dengan nomor baris + alasan.
- [ ] `Player` duplikat dalam satu file → baris kedua ditolak dengan alasan "duplicate player name".
- [ ] Import bersifat replace-all: isi data member setelah import = persis isi CSV.
- [ ] Dialog konfirmasi sebelum import menyebutkan jumlah member yang akan dihapus.
- [ ] Laporan hasil import menampilkan jumlah baris diterima, jumlah ditolak + nomor baris + alasan.
- [ ] Nama dengan karakter non-Latin dan emoji (mis. `ミLuuk丶Maw`, `Killuaツ`) tampil utuh di UI.
- [ ] Unit test parser: BOM/CRLF, validasi header, skip per baris, duplikat.
- [ ] Test integrasi dengan fixture `import.csv` (148 baris) → 148 diterima, 0 ditolak.

## Comments

- (kosong)
