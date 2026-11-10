# 04: Editor lineup drag & drop

**What to build:** Guild manager menyusun lineup 12 tim × 5 member dengan menyeret member dari pool ke slot tim. Semua perubahan langsung tersimpan tanpa tombol simpan dan tanpa reload halaman, dan lineup bisa juga disusun tanpa drag (klik member → klik slot, atau penuh keyboard).

**Spec:** `.scratch/guild-league-lineup/spec.md` US-2, §4.6

**Blocked by:** 03 — Import CSV member

**Status:** ready-for-agent

- [ ] Area admin menampilkan panel pool member (semua member guild) dan 12 kartu tim dengan 5 slot masing-masing.
- [ ] Drop member ke slot → member masuk; drop ke slot yang sudah terisi ditolak; member yang sudah punya tim tidak bisa masuk tim lain; tim maksimal 5 member.
- [ ] Setiap perubahan tersimpan otomatis (server action) tanpa tombol "Simpan" dan tanpa reload halaman.
- [ ] Jalur setara tanpa drag tersedia sebagai fitur wajib: pilih member di pool (klik / tekan Enter) → pilih slot → member masuk, dan dapat dioperasikan penuh via keyboard.
- [ ] Membuang member dari slot (drag keluar atau tombol keluarkan) mengembalikan member ke pool.
- [ ] Error dari server (mis. slot bentrok karena admin lain) ditampilkan sebagai pesan; UI tidak boleh menampilkan state optimistis yang keliru.
- [ ] Test e2e: assign via drag, assign via klik/keyboard, tolak slot terisi, tolak member yang sudah punya tim, unassign.

## Comments

- (kosong)
