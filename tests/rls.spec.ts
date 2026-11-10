import { expect, test } from "@playwright/test";

// Bukti RLS di lapisan HTTP yang dipakai aplikasi: anon key TIDAK boleh menulis.
// Padanan SQL-nya ada di supabase/tests/rls_anon_write.sql.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const HEADERS = {
  apikey: PUB,
  Authorization: `Bearer ${PUB}`,
  "Content-Type": "application/json",
};

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

test("anon tidak boleh update atau delete tim", async () => {
  const patch = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ lane: "bot" }),
  });
  expect(await patch.json()).toEqual([]);

  const del = await fetch(`${URL}/rest/v1/teams?position=eq.1`, {
    method: "DELETE",
    headers: { ...HEADERS, Prefer: "return=representation" },
  });
  expect(await del.json()).toEqual([]);
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
