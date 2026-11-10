# 05: Label lane per tim

**What to build:** Guild manager menandai tiap tim dengan lane (top / mid / bot) dan bisa memindahkannya kapan saja; halaman publik mengelompokkan tim per lane beserta ringkasan jumlahnya. Lane bersifat label — komposisi bebas, tidak divalidasi.

**Spec:** `.scratch/guild-league-lineup/spec.md` US-3

**Blocked by:** 04 — Editor lineup drag & drop

**Status:** needs-triage

> Implementasi kode **selesai dan terverifikasi** (51/51 test hijau, dijalankan terhadap build
> produksi `next start`, bukan hanya dev server). Tidak ada item yang menunggu manusia —
> ticket dikembalikan ke maintainer untuk ditutup.

- [x] Tiap tim punya label lane `top` | `mid` | `bot`; seed default 4 top, 4 mid, 4 bot. — sudah ada sejak ticket 01: kolom `teams.lane` (`member_lane`) + seed migration `20261110115957_init_lineup_schema.sql` (tim 1–4 top, 5–8 mid, 9–12 bot). Tidak ada perubahan skema di ticket ini.
- [x] Admin dapat memindahkan lane sebuah tim; jumlah tim per lane bebas (5/4/3, 6/3/3, dst. boleh) dan tidak menghasilkan error. — `setTeamLaneAction(teamPosition, lane)` di `src/app/admin/lineup/actions.ts` + dropdown lane per kartu tim di editor (`data-testid="team-lane-N"`). Tidak ada pemeriksaan jumlah per lane sama sekali.
- [x] Halaman lineup publik mengelompokkan tim per lane dan menampilkan ringkasan jumlah tim per lane. — sudah ada sejak ticket 01 (`groupByLane()` di `src/lib/lineup.ts`, ringkasan + section per lane di `src/app/(public)/page.tsx`); ticket ini hanya menambah `data-testid="lane-count-<lane>"` pada ringkasan supaya bisa diuji.
- [x] Lane tidak memengaruhi validasi lineup dan tidak membatasi siapa boleh masuk tim. — `assignMemberAction` / `unassignMemberAction` tidak menyentuh `teams.lane`; test e2e membuktikan slot 1-1 Tim 1 tetap terisi member yang sama setelah timnya pindah lane.
- [x] Test e2e: pindah lane satu tim → jumlah tim per lane di halaman publik ikut berubah, lineup tetap utuh. — `tests/team-lane.spec.ts`: baseline 4/4/4, ubah Tim 1 ke `bot` lewat dropdown → publik jadi 3/4/5, Tim 1 muncul di grup BOT dengan membernya, 12 kartu tim, 59 slot kosong (lineup utuh).

## Comments

### Yang dikerjakan

- **Server action** `src/app/admin/lineup/actions.ts` — `setTeamLaneAction(teamPosition, lane)`.
  - Pagar: `requireAdmin()` (lapis kedua di balik proxy), validasi posisi 1–12 & lane ∈ `LANES`, lalu update `teams` via sesi admin (RLS), bukan service-role key.
  - Update memakai `.select("position")` supaya tim yang tidak ada tidak dilaporkan sebagai sukses diam-diam.
  - Setelah sukses: `revalidatePath("/")` + `revalidatePath("/admin/lineup")` (memakai `revalidateLineup()` yang sudah ada).
  - Helper `isTeamPositionInBounds()` diekstrak agar batas posisi tim dipakai bersama `isSlotInBounds()` (temuan review).
- **UI** `src/app/admin/lineup/lineup-editor.tsx` — dropdown native per kartu tim (`CardAction`, `aria-label="Lane Tim N"`), menggantikan badge lane. Perubahan langsung tersimpan lewat jalur `run()` yang sudah ada: tanpa tombol simpan, tanpa optimistic update, error tampil di `role="alert"`.
  - Daftar lane dikirim dari server (`lanes={LANES}`) karena `@/lib/lineup` mengimpor klien Supabase server-only — mengimpor `LANES` langsung dari sana sempat menjebol batas server/client (halaman `/admin/lineup` gagal render; ketahuan saat test e2e pertama).
- **Halaman publik** `src/app/(public)/page.tsx` — hanya `data-testid="lane-count-<lane>"` pada ringkasan; pengelompokan & hitungannya sudah ada sebelumnya.
- **Test** `tests/team-lane.spec.ts` — 1 e2e (DB dev sungguhan). Lane dikembalikan ke default 4/4/4 sebelum & sesudah test, member hasil seed dihapus di `afterAll`.
- **Verifikasi**: `npx tsc --noEmit` bersih, `npx eslint src tests` bersih, `npm run build` sukses, suite penuh **51/51 hijau** terhadap build produksi (`next start`).

### Keputusan / penyimpangan dari spec

1. **Kontrol lane berupa `<select>` native, bukan komponen shadcn `Select`.** Belum ada komponen `select` di `src/components/ui`, dan tiga tombol per kartu × 12 tim akan lebih ramai. Satu elemen native sudah keyboard-accessible dan langsung memicu server action.
2. **Badge lane di editor diganti dropdown.** Badge hanya menampilkan; dropdown menampilkan sekaligus mengubah, jadi tidak ada dua sumber tampilan lane di satu kartu. Badge lane di halaman publik tetap.
3. **Tidak ada validasi komposisi lane di mana pun** (sesuai D4/AC3.2): 0–12 tim per lane semuanya sah.
