# 05: Label lane per tim

**What to build:** Guild manager menandai tiap tim dengan lane (top / mid / bot) dan bisa memindahkannya kapan saja; halaman publik mengelompokkan tim per lane beserta ringkasan jumlahnya. Lane bersifat label — komposisi bebas, tidak divalidasi.

**Spec:** `.scratch/guild-league-lineup/spec.md` US-3

**Blocked by:** 04 — Editor lineup drag & drop

**Status:** ready-for-agent

- [ ] Tiap tim punya label lane `top` | `mid` | `bot`; seed default 4 top, 4 mid, 4 bot.
- [ ] Admin dapat memindahkan lane sebuah tim; jumlah tim per lane bebas (5/4/3, 6/3/3, dst. boleh) dan tidak menghasilkan error.
- [ ] Halaman lineup publik mengelompokkan tim per lane dan menampilkan ringkasan jumlah tim per lane.
- [ ] Lane tidak memengaruhi validasi lineup dan tidak membatasi siapa boleh masuk tim.
- [ ] Test e2e: pindah lane satu tim → jumlah tim per lane di halaman publik ikut berubah, lineup tetap utuh.

## Comments

- (kosong)
