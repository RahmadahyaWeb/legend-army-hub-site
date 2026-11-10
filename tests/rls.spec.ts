import { expect, test } from "@playwright/test";

// Bukti RLS di lapisan HTTP yang dipakai aplikasi: publishable key (peran anon)
// TIDAK boleh menulis. Padanan SQL-nya ada di supabase/tests/rls_anon_write.sql.
//
// Catatan: test ini sama sekali tidak boleh merusak data. Semua percobaan write
// memakai nilai yang sama dengan nilai saat ini (no-op) atau dipulihkan kembali,
// sehingga policy yang bocor hanya membuat test gagal — bukan menghapus tim.

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
