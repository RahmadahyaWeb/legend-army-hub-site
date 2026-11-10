# 06: Import ulang mempertahankan lineup

**What to build:** Guild manager meng-import CSV terbaru tanpa kehilangan susunan lineup yang sudah disusun: member yang namanya masih ada tetap menempati slot yang sama, member yang tidak ada lagi membuat slot kosong dan namanya tercatat di laporan import — jadi refresh roster tidak menghapus kerja lineup.

**Spec:** `.scratch/guild-league-lineup/spec.md` US-1 (AC1.7), D7, R1

**Blocked by:** 03 — Import CSV member; 04 — Editor lineup drag & drop

**Status:** ready-for-agent

- [x] Import kedua dengan CSV yang memuat member yang sama → slot yang sama terisi member yang sama (kunci pencocokan: `Player`).
- [x] Member yang tidak ada di CSV baru → slotnya kosong, dan namanya tercatat di laporan import.
- [x] Sifat replace-all tetap berlaku untuk data member: member lama yang tidak ada di CSV baru tidak tersisa.
- [x] Snapshot slot (posisi tim, nomor slot, nama member) diambil sebelum data member lama dihapus, lalu slot dibangun ulang dari snapshot tersebut.
- [x] Test integrasi: lineup berisi 3 slot → import CSV tanpa 1 member → 2 slot tetap terisi, 1 slot kosong, dan nama member yang hilang muncul di laporan import.

## Comments

### Catatan dari ticket 03 (sudah dikerjakan sebagian)

- Mekanisme **snapshot lineup → delete → relink by nama** sudah ada di ticket 03, di dalam
  fungsi Postgres `import_members()` (`supabase/migrations/20261110220000_import_members_rpc.sql`):
  snapshot `(team_position, slot_no, player_name)` diambil sebelum member dihapus, lalu slot
  dibangun ulang dengan pencocokan nama **case-insensitive**. Member yang tidak ada di CSV
  → slot kosong + namanya dikembalikan di laporan import (`dropped`).
- Test integrasinya juga sudah ada: `tests/import-members.spec.ts` → "member yang tidak ada
  di CSV baru kehilangan slot dan tercatat di laporan" (lineup 3 slot → import tanpa 1 member
  → 2 slot terisi, 1 kosong, nama yang hilang muncul di laporan).
- Yang **masih tersisa** untuk ticket ini: sisi editor — import ulang dari editor lineup
  (ticket 04/05), memastikan susunan yang disusun lewat drag & drop tetap terisi setelah
  roster di-import ulang, dan UX kalau ada slot yang jadi kosong.


### Selesai (sisi editor)

- `runImportAction` sekarang juga `revalidatePath("/admin/lineup")` — sebelumnya
  editor lineup masih menyajikan data member lama setelah import ulang.
- Laporan import menampilkan tombol **"Isi slot kosong di editor lineup"** kalau ada
  slot yang jadi kosong (`import-fix-lineup-link`), supaya admin langsung bisa
  memperbaiki lineup tanpa menebak halaman.
- Test integrasi baru di `tests/import-members.spec.ts` → "lineup yang disusun di
  editor tetap terisi setelah import ulang": lineup 3 slot (slot 1 lewat drag & drop,
  2 lewat klik) → import CSV tanpa 1 member → 2 slot tetap terisi member yang sama,
  slot ketiga kosong, nama yang hilang muncul di laporan.
- Tidak ada import control di `/admin/lineup` (import tetap hanya dari
  `/admin/members`) dan editor tidak menandai slot mana yang dikosongkan import —
  laporan import yang menyebut Tim + nomor slot, jadi keduanya sengaja tidak dibuat.
