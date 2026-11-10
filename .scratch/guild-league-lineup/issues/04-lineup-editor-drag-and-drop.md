# 04: Editor lineup drag & drop

**What to build:** Guild manager menyusun lineup 12 tim × 5 member dengan menyeret member dari pool ke slot tim. Semua perubahan langsung tersimpan tanpa tombol simpan dan tanpa reload halaman, dan lineup bisa juga disusun tanpa drag (klik member → klik slot, atau penuh keyboard).

**Spec:** `.scratch/guild-league-lineup/spec.md` US-2, §4.6

**Blocked by:** 03 — Import CSV member

**Status:** needs-triage

> Implementasi kode **selesai dan terverifikasi** (50/50 test hijau dua kali berturut-turut,
> dijalankan terhadap build produksi `next start`, bukan hanya dev server). Tidak ada item
> yang menunggu manusia — ticket dikembalikan ke maintainer untuk ditutup.

- [x] Area admin menampilkan panel pool member (semua member guild) dan 12 kartu tim dengan 5 slot masing-masing. — `/admin/lineup`; `tests/lineup-editor.spec.ts` "panel berisi seluruh member dan 12 kartu tim × 5 slot" (12 `editor-team-card`, 60 slot, pool = seluruh member).
- [x] Drop member ke slot → member masuk; drop ke slot yang sudah terisi ditolak; member yang sudah punya tim tidak bisa masuk tim lain; tim maksimal 5 member. — `assignMemberAction` menolak slot terisi, member yang sudah punya tim, dan slot di luar 1–12 × 1–5; database tetap sumber kebenaran (PK `team_position+slot_no`, UNIQUE `member_id`). Test: "drop ke slot yang sudah terisi ditolak dengan pesan", "member yang sudah punya tim tidak bisa masuk tim lain", "tim yang sudah penuh tidak menerima member baru".
- [x] Setiap perubahan tersimpan otomatis (server action) tanpa tombol "Simpan" dan tanpa reload halaman. — `assignMemberAction` / `unassignMemberAction` + `router.refresh()`; test klik dan test drag sama-sama memasang penanda `window` dan membuktikan penanda selamat (tidak ada reload), lalu membaca isi `lineup_slots` lewat REST.
- [x] Jalur setara tanpa drag tersedia sebagai fitur wajib: pilih member di pool (klik / tekan Enter) → pilih slot → member masuk, dan dapat dioperasikan penuh via keyboard. — tombol pool + tombol slot kosong (bukan div ber-`onClick`), status pilihan diumumkan lewat `aria-live`; test "klik member lalu klik slot…" dan "jalur keyboard: Enter di member, lalu Enter di slot kosong".
- [x] Membuang member dari slot (drag keluar atau tombol keluarkan) mengembalikan member ke pool. — tombol "Keluarkan" per slot (ticket membolehkan salah satu jalur); test "tombol Keluarkan mengembalikan member ke pool" (slot kosong, member aktif lagi di pool, baris `lineup_slots` hilang).
- [x] Error dari server (mis. slot bentrok karena admin lain) ditampilkan sebagai pesan; UI tidak boleh menampilkan state optimistis yang keliru. — tidak ada optimistic update: setelah action, state selalu diambil ulang dari server. Test: admin lain mengisi slot/menempatkan member setelah halaman dirender → pesan "Slot sudah terisi member lain." / "Member ini sudah ada di Tim 1, slot 3." muncul, dan slot akhirnya menampilkan keadaan sebenarnya.
- [x] Test e2e: assign via drag, assign via klik/keyboard, tolak slot terisi, tolak member yang sudah punya tim, unassign. — `tests/lineup-editor.spec.ts` (10 test) + unit test pemetaan error constraint di `tests/lineup.unit.spec.ts`.

## Comments

### Yang dikerjakan

- **Query** `src/lib/lineup.ts` — tambahan `getPoolMembers()` (seluruh member + slotnya, urut nama), konstanta `TEAMS_PER_LINEUP` (12), dan `slotAssignError()` (pemetaan pelanggaran constraint ke pesan admin).
- **Server actions** `src/app/admin/lineup/actions.ts` — `assignMemberAction(memberId, teamPosition, slotNo)` dan `unassignMemberAction(memberId)`.
  - Pagar: `requireAdmin()` (lapis kedua di balik proxy), lalu validasi bentuk input, lalu cek ke DB untuk pesan yang jelas. Constraint DB tetap penentu akhir (race antar admin) dan errornya dikembalikan sebagai pesan, bukan ditekan.
  - Setelah sukses: `revalidatePath("/")` + `revalidatePath("/admin/lineup")` supaya halaman publik dan editor ikut segar.
  - Memakai sesi admin + RLS, bukan service-role key (sama seperti ticket 03).
- **UI** `src/app/admin/lineup/page.tsx` + `lineup-editor.tsx` — pool di kiri (bisa digulir), 12 kartu tim di kanan; drag lewat `@dnd-kit/core` (`PointerSensor`, aktivasi 4 px) **dan** jalur klik/keyboard sebagai jalur setara; pesan error di `role="alert"`; tombol nonaktif selama transisi.
- **Test** `tests/lineup-editor.spec.ts` (10 e2e, DB dev sungguhan) + 1 unit test `slotAssignError`. Total suite: **50/50 hijau** (0 skipped).
- **`playwright.config.ts`** — `workers: 1`. Semua spec memakai satu database dev dan import bersifat replace-all, jadi spec paralel saling menimpa data (sebelumnya hanya kebetulan tidak bentrok).

### Keputusan / penyimpangan dari spec

1. **AC2.6 "member yang dipakai tim lain tidak muncul sebagai draggable (difilter)" vs checklist ticket "panel berisi semua member guild".** Member yang sudah punya tim **tetap tampil di pool tapi nonaktif**, dengan badge `Tim N`. Dipilih tampil-nonaktif karena: (a) checklist ticket meminta pool berisi semua member; (b) admin jadi tahu member itu ada di tim mana, bukan menghilang tanpa jejak; (c) hasilnya sama — tidak bisa diseret, tidak bisa diklik, dan action menolaknya juga. Kalau maintainer ingin benar-benar disembunyikan (atau dipisah ke bagian "sudah ditempatkan"), itu perubahan satu `filter`.
2. **Drop ke slot terisi sekarang menampilkan pesan, bukan no-op diam-diam.** Awalnya slot terisi dibuat bukan drop target (`useDroppable({disabled})`), jadi drop diabaikan tanpa penjelasan. Sekarang drop tetap diteruskan ke action dan server membalas "Slot sudah terisi member lain." — penolakan AC2.2 jadi terlihat, dan tidak ada state optimistis karena UI diambil ulang dari server.
3. **Tidak ada optimistic update sama sekali.** Setiap action diakhiri `router.refresh()`; UI tidak pernah menampilkan penempatan yang belum dikonfirmasi server. Lebih lambat sedikit, tapi sesuai AC terakhir ticket.
4. **"Tim penuh" = kelima slot terisi.** Skema hanya punya `slot_no 1..5`, jadi percobaan ke slot ke-6 ditolak `isSlotInBounds` sebagai "Slot tidak valid." sebelum menyentuh DB; percobaan ke slot yang sudah terisi ditolak dengan pesan slot terisi. Tidak ada cek "jumlah member per tim" terpisah karena tidak ada baris yang bisa lolos.
5. **Pemetaan error constraint memakai SQLSTATE + nama constraint, bukan teks bebas.** Versi pertama mencocokkan potongan pesan (`"slot_no"`, `"team_position"`) yang **tidak pernah muncul** di pesan 23505 Postgres (`duplicate key value violates unique constraint "lineup_slots_pkey"`), sehingga bentrok slot jatuh ke pesan generik, dan pelanggaran FK (`..._member_id_fkey`) salah dilaporkan sebagai "member sudah ada di tim lain". Sekarang: `23505` + `member_id` → member dobel, `23505` lainnya → slot terisi, `23503` → member tidak ditemukan; ada unit test-nya.
6. **Action tinggal di `src/app/admin/lineup/actions.ts`, bukan `app/actions/*.ts`** seperti sketsa §4.1 — mengikuti konvensi repo yang sudah dipakai ticket 02/03 (action per route). Sama seperti keputusan ticket 03.
7. **Jalur hapus: tombol "Keluarkan", bukan drag keluar.** Ticket menulis "drag keluar **atau** tombol keluarkan"; drag keluar butuh drop target tambahan (area pool) yang tidak ada di spec. Tombol sudah memenuhi AC2.4 dan jalur keyboard.
8. **Satu login UI per file test + token admin di-cache.** Percobaan pertama (login ulang tiap test) kena **429 rate limit** password grant Supabase saat suite dijalankan penuh dua kali; sekarang file test login sekali lalu memasang ulang cookie sesi per test, dan token REST di-cache.

### Hasil code review (2 sumbu: Standards + Spec)

Review dijalankan terhadap diff `HEAD` (belum di-commit saat review), dua sub-agent paralel.

**Sumbu Standards**

1. `TEAM_COUNT`/`SLOTS_PER_TEAM` diduplikasi dari `src/lib/lineup.ts` (dua sumber kebenaran) → diimpor dari lib (`TEAMS_PER_LINEUP`, `SLOTS_PER_TEAM`).
2. `@dnd-kit/utilities` ditambahkan tapi tidak dipakai → dihapus dari `package.json`.
3. `assign`/`unassign` mengulang bentuk `startTransition → action → set error → refresh` → diekstrak jadi satu `run()`.
4. `revalidatePath("/"); revalidatePath("/admin/lineup");` diulang → jadi `revalidateLineup()`.
5. Pemetaan error berbasis teks pesan (lihat keputusan 5) → diganti SQLSTATE + nama constraint, dipindah ke `slotAssignError()` di lib supaya bisa diuji unit.
6. **Disimpulkan bukan pelanggaran**: `slotKey`/`slotId` dan pasangan `{teamPosition, slotNo}` yang tersebar — format kunci satu baris, dipakai di tiga tempat dengan konteks berbeda; membuat tipe `SlotRef` hanya menambah lapisan.

**Sumbu Spec**

1. **"Assign ke tim penuh → error" (§4.6) belum ada test**, dan assertion lama `empty-slot-1-2` nonaktif itu **vakum** (nonaktif karena tidak ada member terpilih, bukan karena tim penuh) → test baru mengisi kelima slot tim 1, memastikan tidak ada slot kosong di kartu itu, dan menyeret member ke-6 ke slot yang terisi.
2. **Drop ke slot terisi hanya no-op tanpa pesan** (AC2.2) → lihat keputusan 2 + assertion pesan di test.
3. **Test "error server" tidak menyentuh jalur race sungguhan** — karena cek awal action menangkap duluan, yang teruji adalah pesan pra-cek, bukan constraint. Pemetaan constraint yang salah (keputusan 5) karena itu hanya bisa ditemukan lewat review; sekarang ditutup unit test `slotAssignError`. Jalur race penuh (dua admin lolos pra-cek bersamaan) tidak bisa direproduksi lewat UI tanpa hook interleaving — ditinggalkan dengan alasan ini.
4. **Test drag belum membuktikan "tanpa reload"** → penanda `window` ditambahkan di test drag juga.
5. **AC2.6 (difilter) tidak persis sama** → keputusan 1 (sengaja, dengan alasan).

### Catatan operasional

- Perintah verifikasi: `npm run typecheck`, `npm run lint`, `npm run build`, lalu `npm run start` + `npx playwright test` → **50/50 passed**, dijalankan dua kali berturut-turut untuk memastikan tidak flaky.
- Test e2e menyiapkan datanya sendiri: `tests/lineup-editor.spec.ts` menghapus semua member lalu menanam 6 member `E2E Alpha … E2E Zeta` di awal tiap test (database dev, bukan produksi). Setelah suite, DB dev berisi 6 member E2E itu — jalankan import ulang `import.csv` kalau ingin data guild asli.
- **Dev-only insight Next** (bukan dari ticket ini): `next dev` mencatat `Route "/admin": Next.js encountered the unstable value Date.now() while prerendering` dari `AdminLayout` → `createClient()` (`_recoverAndRefresh`). Sudah ada sejak ticket 02, dan tidak menggagalkan `next build` (`/admin`, `/admin/lineup`, `/admin/members` tetap `ƒ` dynamic). Catat untuk ticket 08 kalau mau dibersihkan.
