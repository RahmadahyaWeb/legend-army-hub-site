// Seed akun untuk Legend Army Hub — satu-satunya jalur pembuatan akun di
// project ini (tidak ada UI/endpoint signup).
// Spec: .scratch/guild-league-lineup/spec.md §4.4, §4.5
//
// Pakai: npm run seed:admin
// Env wajib: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//            ADMIN_EMAIL, ADMIN_PASSWORD
// Env opsional: TEST_MEMBER_EMAIL + TEST_MEMBER_PASSWORD
//            (akun non-admin, dipakai test e2e untuk membuktikan 403)

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local opsional (mis. di CI) — env dari shell yang dipakai.
}

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Env wajib belum diisi: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Cari user yang sudah ada berdasarkan email (seed harus idempotent). */
async function findUserByEmail(email) {
  const wanted = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const found = data.users.find(
      (user) => (user.email ?? "").toLowerCase() === wanted,
    );
    if (found) return found;
    if (data.users.length < 1000) return null;
  }

  return null;
}

/** Buat atau perbarui user, lalu pastikan `app_metadata.role` persis. */
async function upsertUser({ email, password, role }) {
  const appMetadata = { role };
  const existing = await findUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;

    return { id: data.user.id, email, role, action: "diperbarui" };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {},
    app_metadata: appMetadata,
  });
  if (error) throw error;

  return { id: data.user.id, email, role, action: "dibuat" };
}

async function main() {
  const admin = await upsertUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  });
  console.log(
    `Admin  : ${admin.email} (${admin.id}) role=${admin.role} -> ${admin.action}`,
  );

  const memberEmail = process.env.TEST_MEMBER_EMAIL;
  const memberPassword = process.env.TEST_MEMBER_PASSWORD;

  if (memberEmail && memberPassword) {
    const member = await upsertUser({
      email: memberEmail,
      password: memberPassword,
      role: "member",
    });
    console.log(
      `Member : ${member.email} (${member.id}) role=${member.role} -> ${member.action}`,
    );
  } else {
    console.log(
      "Member : dilewati — isi TEST_MEMBER_EMAIL + TEST_MEMBER_PASSWORD untuk akun non-admin test e2e.",
    );
  }
}

main().catch((error) => {
  console.error(`Seed gagal: ${error?.message ?? error}`);
  process.exit(1);
});
