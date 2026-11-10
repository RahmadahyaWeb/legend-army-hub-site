# 06: Import ulang mempertahankan lineup

**What to build:** Guild manager meng-import CSV terbaru tanpa kehilangan susunan lineup yang sudah disusun: member yang namanya masih ada tetap menempati slot yang sama, member yang tidak ada lagi membuat slot kosong dan namanya tercatat di laporan import — jadi refresh roster tidak menghapus kerja lineup.

**Spec:** `.scratch/guild-league-lineup/spec.md` US-1 (AC1.7), D7, R1

**Blocked by:** 03 — Import CSV member; 04 — Editor lineup drag & drop

**Status:** ready-for-agent

- [ ] Import kedua dengan CSV yang memuat member yang sama → slot yang sama terisi member yang sama (kunci pencocokan: `Player`).
- [ ] Member yang tidak ada di CSV baru → slotnya kosong, dan namanya tercatat di laporan import.
- [ ] Sifat replace-all tetap berlaku untuk data member: member lama yang tidak ada di CSV baru tidak tersisa.
- [ ] Snapshot slot (posisi tim, nomor slot, nama member) diambil sebelum data member lama dihapus, lalu slot dibangun ulang dari snapshot tersebut.
- [ ] Test integrasi: lineup berisi 3 slot → import CSV tanpa 1 member → 2 slot tetap terisi, 1 slot kosong, dan nama member yang hilang muncul di laporan import.

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

