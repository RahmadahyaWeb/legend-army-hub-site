// Cek endpoint signup Supabase sudah ditutup.
// Spec: .scratch/guild-league-lineup/spec.md §4.5 (tidak ada endpoint signup
// terbuka; satu-satunya jalur pembuatan akun = seed admin).
//
// Pakai: npm run check:signup
// Nonaktifkan signup di dashboard: Authentication > Sign In / Providers >
// Email > Enable sign-ups = OFF.

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local opsional (mis. di CI) — env dari shell yang dipakai.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL belum diisi.");
  process.exit(1);
}

const response = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
});

if (!response.ok) {
  console.error(`GAGAL: settings auth tidak bisa dibaca (HTTP ${response.status}).`);
  process.exit(1);
}

const settings = await response.json();

if (settings.disable_signup !== true) {
  console.error(
    "GAGAL: signup Supabase masih terbuka (disable_signup=false). Nonaktifkan di dashboard Supabase.",
  );
  process.exit(1);
}

console.log("OK: signup Supabase tertutup (disable_signup=true).");
