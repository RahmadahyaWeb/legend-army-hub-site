# 03: Import CSV member

**What to build:** Guild manager meng-upload file CSV export guild dari area admin; website memuat seluruh member dari file itu (replace-all), menolak baris bermasalah tanpa menggagalkan import, dan menampilkan laporan apa yang masuk dan apa yang ditolak beserta alasannya.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.3, US-1

**Blocked by:** 02 — Auth admin dan proteksi route

**Status:** needs-triage

> Implementasi kode **selesai dan terverifikasi** (37/37 test hijau, dijalankan terhadap
> build produksi `next start`, bukan hanya dev server). Tidak ada item yang menunggu
> manusia — ticket dikembalikan ke maintainer untuk ditutup.

- [x] Form upload CSV di area admin; file > 5 MB atau > 2000 baris ditolak dengan pesan jelas. — `/admin/members`; batas ditegakkan di server (`src/app/admin/members/actions.ts` `readCsvFile` + `MAX_IMPORT_BYTES`, `MAX_IMPORT_ROWS` di `src/lib/csv.ts`), bukan hanya di UI. `next.config.ts` → `serverActions.bodySizeLimit: "6mb"` supaya file sah tidak ditolak batas default Next (1 MB).
- [x] Header divalidasi terhadap 12 kolom wajib (urutan bebas, pencocokan nama case-insensitive + trim); file dengan BOM UTF-8 dan line ending CRLF diterima, BOM tidak ikut jadi nama kolom pertama. — `src/lib/csv.ts`; dibuktikan unit test `tests/csv.unit.spec.ts` (BOM+CRLF, urutan bebas, case-insensitive).
- [x] Header tidak cocok → import ditolak utuh dengan pesan menyebut kolom yang bermasalah; tidak ada data yang berubah. — pesan menyebut kolom wajib yang hilang / kolom tak dikenal / kolom dobel; e2e `import menolak file dengan header salah tanpa mengubah data` (jumlah member sebelum == sesudah).
- [x] Baris dengan nilai non-numerik pada kolom numerik ditolak **per baris** (bukan menggagalkan seluruh file), dengan nomor baris + alasan. — `Lv.`, `Gear Score`, `Weekly`, `Weekly Contribution`, `Total Contribution`; alasan `kolom "Gear Score" bukan angka: "abc"` + nomor baris di file.
- [x] `Player` duplikat dalam satu file → baris kedua ditolak dengan alasan "duplicate player name". — pencocokan duplikat case-insensitive (supaya relink lineup by nama tidak ambigu); alasan persis `duplicate player name`.
- [x] Import bersifat replace-all: isi data member setelah import = persis isi CSV. — fungsi Postgres `import_members()`: `delete from guild_members where true` + insert payload, satu transaksi; e2e import `import.csv` → isi tabel = 148 baris (dicek lewat REST).
- [x] Dialog konfirmasi sebelum import menyebutkan jumlah member yang akan dihapus. — dialog konfirmasi di `/admin/members`: "Import akan menghapus **{currentMembers}** member yang ada sekarang…"; angkanya diambil dari hitungan member di DB saat pratinjau.
- [x] Laporan hasil import menampilkan jumlah baris diterima, jumlah ditolak + nomor baris + alasan. — panel laporan: diterima / ditolak / dihapus / slot tetap terisi + daftar baris ditolak (nomor baris + alasan) + daftar member yang kehilangan slot lineup.
- [x] Nama dengan karakter non-Latin dan emoji (mis. `ミLuuk丶Maw`, `Killuaツ`) tampil utuh di UI. — fixture `tests/fixtures/unicode-members.csv` dipakai e2e: nama tampil utuh di pratinjau, dan ikut tersimpan ke DB.
- [x] Unit test parser: BOM/CRLF, validasi header, skip per baris, duplikat. — `tests/csv.unit.spec.ts` (14 test).
- [x] Test integrasi dengan fixture `import.csv` (148 baris) → 148 diterima, 0 ditolak. — unit test parser + e2e import lewat UI (upload `import.csv` → 148 diterima, 0 ditolak, isi tabel = 148).

## Comments

### Yang dikerjakan

- **Parser CSV** `src/lib/csv.ts` (murni, tanpa I/O → bisa diuji tanpa database). Pakai `papaparse` (RFC4180; sudah disebut-justifikasi di spec §4.1, belum terpasang sebelum ticket ini) + `@types/papaparse`.
  - BOM di-strip, LF/CRLF keduanya diterima, baris kosong diabaikan.
  - Header: 12 kolom wajib, urut bebas, pencocokan `trim` + case-insensitive. Kolom hilang / tak dikenal / dobel → **file ditolak utuh** dengan pesan yang menyebut kolom bermasalah.
  - Per baris: jumlah kolom ≠ 12, nilai non-numerik di 5 kolom numerik, nama player kosong, `Player` duplikat (case-insensitive) → **ditolak per baris** dengan nomor baris + alasan.
  - `Id` diperlakukan informasional (spec §4.2 `source_id` nullable): kalau bukan angka → `null`, bukan alasan tolak baris.
  - Batas: > 2000 baris data → file ditolak utuh; file > 5 MB ditolak sebelum diparse; file yang bukan UTF-8 (ada U+FFFD) ditolak, supaya nama tidak rusak diam-diam.
- **Penulisan ke DB** `supabase/migrations/20261110220000_import_members_rpc.sql` — fungsi `public.import_members(payload jsonb)`. Satu transaksi: snapshot lineup → hapus member lama → insert member baru → bangun ulang slot lineup by nama (case-insensitive, D7/AC1.7). Member yang tidak ada di CSV → slot kosong + namanya dikembalikan di laporan (SC2).
  - `SECURITY INVOKER` + `set search_path = public`, jadi **RLS tetap berlaku** di dalam fungsi; ada cek `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` (role non-admin → `42501`).
  - Fungsi mengembalikan `{ deleted, imported, relinked, dropped }` → laporan import.
  - Relink by nama sudah diimplementasikan di sini (wajib menurut kontrak domain §4.2 karena import bersifat replace-all) dan **sudah diverifikasi manual lewat SQL**: lineup 3 slot → import CSV tanpa 1 member → 2 slot tetap terisi, 1 slot kosong, dan nama member yang hilang muncul di `dropped`. Test integrasi otomatis untuk perilaku ini adalah checklist **ticket 06**, jadi tidak diulang di sini.
- **Server action** `src/app/admin/members/actions.ts` — `previewImportAction` (validasi + hitung member saat ini, **tidak mengubah data**) dan `runImportAction` (tulis). Keduanya memanggil `requireAdmin()` (pagar kedua di balik proxy).
- **UI** `src/app/admin/members/page.tsx` + `import-form.tsx` — pilih file → **Periksa** → dialog konfirmasi (menyebut jumlah member yang akan dihapus) → laporan (diterima / ditolak + nomor baris + alasan / dihapus / slot tetap terisi / member yang kehilangan slot). Dialog memakai radix-ui `Dialog` (focus trap, ESC, focus-visible).
- **Test** `tests/csv.unit.spec.ts` (14 unit) + `tests/import-members.spec.ts` (4 e2e, memakai DB dev sungguhan). `npm test` = **37/37 hijau** (0 skipped) terhadap build produksi `next start`: 14 unit CSV + 4 e2e import + test lama (auth/RLS/lineup) tetap hijau.
- **Migrasi sudah diterapkan** ke project `legend-army-hub` (`ugrldjoimmaqmcfkihlv`) dan diverifikasi lewat jalur aplikasi: login admin → `POST /rest/v1/rpc/import_members` → 200, `imported`/`deleted`/`relinked`/`dropped` benar.
- **SC1 (import 148 baris < 5 detik)** terpenuhi: satu panggilan RPC untuk 148 member **251 ms** (diukur langsung ke project dev, `deleted: 148 → imported: 148`).
### Keputusan / penyimpangan dari spec

1. **Import lewat sesi admin, bukan service-role key.** Ticket 01 menuliskan import "harus lewat service role agar tidak bergantung sesi login"; ticket 02 kemudian membuktikan **write admin lewat sesi (publishable key + cookie) sudah cukup** dan service-role tidak wajib untuk write biasa. Implementasi ini memakai sesi admin + RLS, jadi import **justru tidak bisa** dilakukan oleh akun non-admin — guard ada di dua lapis (policy RLS `admin writes …` + cek role di dalam fungsi). Service-role key tidak dipakai sama sekali oleh kode import.
2. **Penulisan lewat fungsi Postgres, bukan beberapa panggilan PostgREST.** Delete-all + insert + relink butuh atomis; kalau salah satu langkah gagal di tengah, data member bisa hilang separuh. Satu fungsi = satu transaksi (gagal ⇒ rollback). Konsekuensinya `is_online` dihitung di SQL (`online_status = '[Online]'`, spec §4.3), bukan dikirim dari client.
3. **`delete from guild_members where true;`** — PostgREST menolak statement `DELETE` tanpa `WHERE` di dalam fungsi (`DELETE requires a WHERE clause`, HTTP 400). Ini baru ketahuan saat RPC dipanggil lewat PostgREST; dipanggil langsung lewat SQL biasa tidak bermasalah.
4. **Nomor baris pada laporan = nomor baris data di file** (header = baris 1). Kalau sebuah field berisi newline di dalam kutip, nomor ini menghitung record, bukan baris fisik.
5. **Duplikat `Player` dianggap case-insensitive.** Alasannya: relink lineup by nama (D7) juga case-insensitive, jadi dua member yang namanya beda casing akan berebut satu slot. Baris kedua ditolak dengan alasan persis `duplicate player name`.
6. **`papaparse` + `@types/papaparse` dipasang** (2 dependency). `papaparse` sudah ada di daftar & justifikasi spec §4.1; parser sendiri ditulis tangan, tapi penanganan quoting RFC4180 bukan hal yang sepele dan perlu diuji.
7. **`serverActions.bodySizeLimit` = `6mb`** di `next.config.ts`. Batas default Next 1 MB akan menolak file CSV yang sah (batas aplikasi 5 MB). Batas ini hanya berlaku untuk request body server action.
8. **Baris dengan kutip tidak ditutup / file bukan UTF-8** ditolak (per baris / per file) supaya tidak ada data yang masuk dalam keadaan rusak. Ini di luar checklist ticket, tapi aturan "jumlah kolom ≠ 12" saja tidak menutup kasusnya.

### Hasil code review (2 sumbu: Standards + Spec)

Review dijalankan terhadap commit `a658c53` (fixed point `156399d`), dua sub-agent paralel.

**Sumbu Standards**

1. **`@types/papaparse` salah tempat** (di `dependencies`, sedangkan semua `@types/*` lain di `devDependencies`) → dipindah ke `devDependencies`.
2. **`bodySizeLimit: "6mb"` tidak cukup** — body request = multipart + base64 ≈ 1,37× ukuran file, jadi file 5 MB bisa ditolak platform **sebelum** cek server jalan, dan admin dapat error mentah, bukan pesan jelas (AC1.8). → `bodySizeLimit` jadi `"8mb"` + cek ukuran di client (`File terlalu besar: X MB (maksimal 5 MB)`); batas 5 MB di server tetap berlaku.
3. **`tests/import-members.spec.ts` pakai non-null assertion** (`PUB!`) → diganti guard env yang melempar pesan jelas, mengikuti pola `tests/rls.spec.ts`.
4. **Duplikasi di `import-form.tsx`** (blok "baris ditolak" & "contoh nama" muncul di preview dan laporan; `handleCancel` identik dengan `handleReset`) → diekstrak jadi komponen `RejectedRows` / `SampleNames` + satu handler.
5. **Duplikasi di `actions.ts`** (dua action mengulang gate admin → baca file → parse) → diekstrak jadi `prepareImport()`.
6. **Mysterious Name**: `headerError()` di `csv.ts` juga dipakai untuk error file kosong / baris berlebih / non-UTF-8 → renamed `fileError()`.
7. **Trust boundary**: `data as ImportRpcResult` (cast jsonb dari database tanpa cek) → diganti type guard `isImportRpcResult()`.
8. **Disimpulkan bukan pelanggaran**: `src/lib/csv.ts` & `src/app/admin/members/actions.ts` menyimpang dari sketsa §4.1 (`lib/csv.ts`, `app/actions/*.ts`) — konvensi repo yang sudah ada (`src/` + action per route, seperti `src/app/login/actions.ts`) yang dipegang.

**Sumbu Spec**

1. **SC1 tidak diukur** → e2e sekarang mengukur durasi konfirmasi → laporan dan assert < 5 detik (terukur ~250 ms untuk 148 baris).
2. **Jalur "member kehilangan slot" (SC2/AC1.6) belum ada test** → e2e baru: lineup 3 slot → import CSV tanpa 1 member → **2 slot tetap terisi, 1 slot kosong, dan namanya muncul di laporan**.
3. **Batas 5 MB belum ada test** → e2e baru: file 5,5 MB ditolak dengan pesan jelas, data tidak berubah.
4. **Di luar AC tapi dipertahankan** (dengan alasan tercatat di atas): guard file bukan UTF-8, dan duplikat `Player` dianggap case-insensitive.

### Catatan operasional

- Batas 5 MB mengikuti spec, tapi di Netlify payload Lambda ±6 MB — file sebesar itu bisa ditolak platform sebelum sampai Next.js. File export guild normal jauh di bawah batas.
- Test e2e import memakai DB dev sungguhan dan sifatnya **replace-all**: isi `guild_members` setelah test = isi file yang terakhir diimpor (`import.csv` → 148 member).
- `src/lib/supabase/database.types.ts` (file generated) ditambah satu entri `Functions.import_members` secara manual supaya panggilan `supabase.rpc(...)` tetap typed. Kalau types di-regenerate, entri itu perlu dipertahankan.

