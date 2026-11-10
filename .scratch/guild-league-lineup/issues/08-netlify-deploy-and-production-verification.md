# 08: Deploy Netlify dan verifikasi produksi

**What to build:** Website live di Netlify dengan konfigurasi env yang benar, dan seluruh checklist verifikasi di spec §4.6 dijalankan terhadap domain produksi — bukan hanya di localhost. Hasil verifikasi dicatat di bagian Comments tiket ini.

**Spec:** `.scratch/guild-league-lineup/spec.md` §4.4, §4.6

**Blocked by:** 02 — Auth admin dan proteksi route; 03 — Import CSV member; 04 — Editor lineup drag & drop; 05 — Label lane per tim; 06 — Import ulang mempertahankan lineup; 07 — Direktori member publik

**Status:** ready-for-agent

- [ ] Repo di-git dan push ke GitHub; site Netlify baru dibuat dan terhubung (project Netlify yang ada sekarang tidak dipakai).
- [ ] Build `npm run build` sukses di Netlify (Next.js runtime + `@netlify/plugin-nextjs`); env var public, service-role, dan seed admin diset di Netlify.
- [ ] Build output dicek: service-role key tidak ada di bundle client.
- [ ] Verifikasi produksi: halaman lineup tampil 12 tim per lane dengan slot terisi; admin bisa login, import CSV, drag & drop menyusun lineup, dan import ulang mempertahankan lineup.
- [ ] Verifikasi produksi: penulisan dari `anon` ditolak (RLS) — dicek langsung di domain produksi.
- [ ] Lighthouse (preset mobile): Performance ≥ 90, Accessibility ≥ 90, LCP < 2.0 detik pada halaman lineup dan halaman member.
- [ ] Runbook singkat ditulis di README: daftar env var, cara import CSV, cara re-ake project Supabase free-tier yang ter-pause idle.
- [ ] Hasil verifikasi dicatat di bagian `## Comments` tiket ini sebelum tiket ditutup.

## Comments

- (kosong)
