import { expect, test } from "@playwright/test";

// Bukti RLS di lapisan HTTP yang dipakai aplikasi: publishable key (peran anon)
// TIDAK boleh menulis. Padanan SQL-nya ada di supabase/tests/rls_anon_write.sql.
//
// Catatan: test ini sama sekali tidak boleh merusak data. Semua percobaan write
// memakai nilai yang sama dengan nilai saat ini (no-op) atau dipulihkan kembali,
// sehingga policy yang bocor hanya membuat test gagal, bukan menghapus tim.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !PUB) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi — isi .env.local dulu.",
  );
}

const HEADERS = {
  apikey: PUB,
  Authorization: `Bearer ${PUB}`,
  "Content-Type": "application/json",
};

async function readTeam(position: number) {
  const res = await fetch(`${URL}/rest/v1/teams?position=eq.${position}&select=position,lane`, {
    headers: HEADERS,
  });
  const rows = await res.json();
  return rows[0];
}

test("anon boleh membaca data lineup", async () => {
  const res = await fetch(`${URL}/rest/v1/teams?select=position,lane&order=position`, {
    headers: HEADERS,
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toHaveLength(12);
});

test("anon tidak boleh insert tim", async () => {
  const res = await fetch(`${URL}/rest/v1/teams`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ position: 13, lane: "top" }),
  });

  expect(res.status).toBe(401);
  expect((await res.json()).code).toBe("42501");
});

test("anon tidak boleh mengubah lane tim", async () => {
  const before = await readTeam(1);

  // Nilai yang dikirim = nilai saat ini, jadi data tidak berubah walau policy bocor.
  const res = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ lane: before.lane }),
  });

  expect(res.status).toBe(200);
  // RLS menyaring baris -> hasil kosong. Kalau bocor, baris ikut dikembalikan.
  expect(await res.json()).toEqual([]);
  expect(await readTeam(1)).toEqual(before);
});

test("anon tidak boleh menghapus tim", async () => {
  const before = await readTeam(1);

  const res = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "DELETE",
    headers: { ...HEADERS, Prefer: "return=representation" },
  });
  const deleted = await res.json();

  // Pemulihan: kalau DELETE ternyata lolos (policy bocor), tim dikembalikan.
  // Kalau policy bekerja, DELETE ditolak dan INSERT ini juga ditolak.
  await fetch(`${URL}/rest/v1/teams`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(before),
  });

  expect(deleted).toEqual([]);
  expect(await readTeam(1)).toEqual(before);
});

test("anon tidak boleh insert slot lineup", async () => {
  const res = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({
      team_position: 1,
      slot_no: 1,
      member_id: "00000000-0000-0000-0000-000000000000",
    }),
  });

  expect(res.status).toBe(401);
  expect((await res.json()).code).toBe("42501");
});

// ---------------------------------------------------------------------------
// User login NON-admin: tokennya asli (password grant), claim app_metadata
// tidak berisi role admin. RLS harus menolaknya di ketiga tabel. Inilah bukti
// bahwa proteksi admin ada di database, bukan hanya di UI.
// ---------------------------------------------------------------------------

const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;

if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error(
    "TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD belum diisi — akun non-admin dipakai test write non-admin.",
  );
}

// Header ditulis di luar fungsi: narrowing dari guard di atas ikut berlaku.
// Di dalam closure, `PUB` kembali jadi `string | undefined` dan TS menolak.
const AUTH_HEADERS = { apikey: PUB, "Content-Type": "application/json" };

async function signInMember() {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD }),
  });

  expect(res.status).toBe(200);
  const { access_token } = await res.json();

  return { ...AUTH_HEADERS, Authorization: `Bearer ${access_token}` };
}

test("user non-admin tidak boleh insert ke ketiga tabel", async () => {
  const headers = await signInMember();

  const inserts = [
    { table: "teams", body: { position: 13, lane: "top" } },
    {
      table: "guild_members",
      body: {
        source_id: 999996,
        player_name: "RLS Non-admin Member",
        level: 99,
        class_name: "Royal Guard",
        title: "Test",
        gender: "Male",
        guild_rank: "CITIZEN",
        gear_score: 1,
        weekly: 1,
        weekly_contribution: 1,
        total_contribution: 1,
        online_status: "Offline",
        is_online: false,
      },
    },
    {
      table: "lineup_slots",
      body: {
        team_position: 2,
        slot_no: 1,
        member_id: "00000000-0000-0000-0000-000000000000",
      },
    },
  ];

  for (const { table, body } of inserts) {
    const res = await fetch(`${URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });

    // 403 (bukan 401 seperti anon): tokennya valid, jadi PostgREST menolak dengan
    // "permission denied"; penyebabnya tetap RLS policy 42501.
    expect(res.status, `insert ${table}`).toBe(403);
    expect((await res.json()).code, `insert ${table}`).toBe("42501");
  }

  // Pemulihan: kalau policy bocor, baris uji membekas di data nyata. Hapus
  // dengan token yang sama (kalau policy bocor, DELETE ini juga lolos).
  await fetch(`${URL}/rest/v1/guild_members?player_name=eq.RLS Non-admin Member`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
});

test("user non-admin tidak boleh mengubah atau menghapus data", async () => {
  const headers = await signInMember();
  const before = await readTeam(1);

  const update = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ lane: before.lane }),
  });

  expect(update.status).toBe(200);
  expect(await update.json()).toEqual([]);
  expect(await readTeam(1)).toEqual(before);

  const remove = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation" },
  });

  expect(await remove.json()).toEqual([]);
  expect(await readTeam(1)).toEqual(before);
});
