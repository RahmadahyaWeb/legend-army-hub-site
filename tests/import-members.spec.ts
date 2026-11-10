import { expect, test, type Page } from "@playwright/test";

// Import CSV member (ticket 03). Test ini memakai database dev sungguhan:
// import bersifat replace-all, jadi isi tabel member = isi CSV.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_EMAIL / ADMIN_PASSWORD belum diisi — isi .env.local dulu (akunnya dibuat `npm run seed:admin`).",
  );
}

if (!URL || !PUB) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi — isi .env.local dulu.",
  );
}

// Header ditulis di luar fungsi: narrowing dari guard di atas ikut berlaku.
// Di dalam closure, `PUB` kembali jadi `string | undefined` dan TS menolak.
const HEADERS = {
  apikey: PUB,
  Authorization: `Bearer ${PUB}`,
  "Content-Type": "application/json",
};

const AUTH_HEADERS = { apikey: PUB, "Content-Type": "application/json" };

async function countMembers(): Promise<number> {
  const res = await fetch(`${URL}/rest/v1/guild_members?select=id`, { headers: HEADERS });
  expect(res.status).toBe(200);

  return (await res.json()).length;
}

/** Header PostgREST dengan sesi admin (toki asli, bukan service role). */
async function adminHeaders(): Promise<Record<string, string>> {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  expect(res.status).toBe(200);
  const { access_token } = await res.json();

  return {
    ...AUTH_HEADERS,
    Authorization: `Bearer ${access_token}`,
    Prefer: "return=representation",
  };
}

type MemberRow = { id: string };

async function insertMembers(
  headers: Record<string, string>,
  names: string[],
): Promise<MemberRow[]> {
  const body = names.map((name, index) => ({
    source_id: 900 + index,
    player_name: name,
    level: 90,
    class_name: "Creator",
    title: "Pathfinder IV",
    gender: "M",
    guild_rank: "WARLORD",
    gear_score: 100 + index,
    weekly: 1,
    weekly_contribution: 1,
    total_contribution: 1,
    online_status: "[Online]",
    is_online: true,
  }));

  const res = await fetch(`${URL}/rest/v1/guild_members`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);

  return res.json();
}

async function insertSlots(
  headers: Record<string, string>,
  slots: { team_position: number; slot_no: number; member_id: string }[],
) {
  const res = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify(slots),
  });
  expect(res.status).toBe(201);
}

async function readSlots(headers: Record<string, string>) {
  const res = await fetch(`${URL}/rest/v1/lineup_slots?select=team_position,slot_no`, {
    headers,
  });
  expect(res.status).toBe(200);

  return (await res.json()) as { team_position: number; slot_no: number }[];
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByTestId("admin-title")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("admin meng-import CSV: pratinjau, konfirmasi, dan laporan", async ({ page }) => {
  await login(page);
  await page.goto("/admin/members");

  await page.getByTestId("import-file").setInputFiles("tests/fixtures/unicode-members.csv");
  await page.getByTestId("import-preview-button").click();

  // Pratinjau: 3 baris diterima, 0 ditolak, nama non-Latin tampil utuh.
  await expect(page.getByTestId("import-preview")).toBeVisible();
  await expect(page.getByTestId("import-accepted")).toHaveText("3");
  await expect(page.getByTestId("import-rejected")).toHaveText("0");
  await expect(page.getByTestId("import-preview-names")).toContainText("ミLuuk丶Maw");
  await expect(page.getByTestId("import-preview-names")).toContainText("Killuaツ");
  await expect(page.getByTestId("import-preview-names")).toContainText("Bopi剥皮");

  // Konfirmasi menyebut jumlah member yang akan dihapus.
  const before = await countMembers();
  await expect(page.getByTestId("import-delete-count")).toHaveText(String(before));

  await page.getByTestId("import-confirm-button").click();

  await expect(page.getByTestId("import-report")).toBeVisible();
  await expect(page.getByTestId("import-accepted")).toHaveText("3");
  await expect(page.getByTestId("import-rejected")).toHaveText("0");
  await expect(page.getByTestId("import-dropped-list")).toBeVisible();

  // Isi tabel member = persis isi CSV (replace-all).
  expect(await countMembers()).toBe(3);
});

test("import file 148 baris: 148 diterima, 0 ditolak, data lama terhapus", async ({ page }) => {
  await login(page);
  await page.goto("/admin/members");

  await page.getByTestId("import-file").setInputFiles("import.csv");
  await page.getByTestId("import-preview-button").click();

  await expect(page.getByTestId("import-preview")).toBeVisible();
  await expect(page.getByTestId("import-accepted")).toHaveText("148");
  await expect(page.getByTestId("import-rejected")).toHaveText("0");

  // Member hasil import sebelumnya (3) akan dihapus — jumlahnya disebut di konfirmasi.
  await expect(page.getByTestId("import-delete-count")).toHaveText("3");

  const started = Date.now();
  await page.getByTestId("import-confirm-button").click();
  await expect(page.getByTestId("import-report")).toBeVisible();

  // SC1: import 148 baris selesai < 5 detik.
  expect(Date.now() - started).toBeLessThan(5000);

  await expect(page.getByTestId("import-accepted")).toHaveText("148");
  await expect(page.getByTestId("import-rejected")).toHaveText("0");
  await expect(page.getByTestId("import-rejected-list")).toHaveCount(0);

  expect(await countMembers()).toBe(148);
});

test("import menolak file dengan header salah tanpa mengubah data", async ({ page }) => {
  await login(page);
  await page.goto("/admin/members");

  await page.getByTestId("import-file").setInputFiles({
    name: "header-salah.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Id,Player,Lv.,Class,Title,Gender,Position,Weekly,Weekly Contribution,Total Contribution,Online Status\n1,XKAGE,93,C,T,M,WARLORD,1,1,1,[Online]\n",
    ),
  });
  await page.getByTestId("import-preview-button").click();

  await expect(page.getByTestId("import-error")).toBeVisible();
  await expect(page.getByTestId("import-error")).toContainText("Gear Score");

  // Tidak ada data yang berubah.
  expect(await countMembers()).toBe(148);
});

test("file lebih besar dari 5 MB ditolak dengan pesan jelas", async ({ page }) => {
  await login(page);
  await page.goto("/admin/members");

  // 5,5 MB (> batas 5 MB) supaya batasnya yang kena, bukan batas jumlah baris.
  const header =
    "Id,Player,Lv.,Class,Title,Gender,Position,Gear Score,Weekly,Weekly Contribution,Total Contribution,Online Status\n";
  const row = "1,BigMember,93,Creator,T,M,WARLORD,1,1,1,1,[Online]\n";
  const buffer = Buffer.from(header + row.repeat(110_000));

  expect(buffer.byteLength).toBeGreaterThan(5 * 1024 * 1024);

  await page.getByTestId("import-file").setInputFiles({
    name: "terlalu-besar.csv",
    mimeType: "text/csv",
    buffer,
  });
  await page.getByTestId("import-preview-button").click();

  await expect(page.getByTestId("import-error")).toBeVisible();
  await expect(page.getByTestId("import-error")).toContainText("terlalu besar");

  // Tidak ada data yang berubah.
  expect(await countMembers()).toBe(148);
});

test("member yang tidak ada di CSV baru kehilangan slot dan tercatat di laporan", async ({
  page,
}) => {
  const headers = await adminHeaders();

  // Lineup 3 slot: Alpha (slot 1), Beta (slot 2), Gamma (slot 3).
  const members = await insertMembers(headers, ["Alpha", "Beta", "Gamma"]);
  await insertSlots(headers, [
    { team_position: 1, slot_no: 1, member_id: members[0].id },
    { team_position: 1, slot_no: 2, member_id: members[1].id },
    { team_position: 1, slot_no: 3, member_id: members[2].id },
  ]);
  expect(await readSlots(headers)).toHaveLength(3);

  await login(page);
  await page.goto("/admin/members");

  // CSV baru hanya memuat Alpha + Beta -> Gamma tidak ada.
  await page.getByTestId("import-file").setInputFiles("tests/fixtures/lineup-members.csv");
  await page.getByTestId("import-preview-button").click();
  await expect(page.getByTestId("import-preview")).toBeVisible();
  await page.getByTestId("import-confirm-button").click();

  await expect(page.getByTestId("import-report")).toBeVisible();

  // Nama member yang kehilangan slot wajib muncul di laporan (SC2 / AC1.6).
  await expect(page.getByTestId("import-dropped-list")).toContainText("Gamma");

  // Dua slot lama tetap terisi member yang sama, slot Gamma jadi kosong.
  const slots = await readSlots(headers);
  expect(slots).toHaveLength(2);
  expect(slots.map((slot) => slot.slot_no).sort()).toEqual([1, 2]);

  // Sifat replace-all tetap berlaku untuk data member.
  expect(await countMembers()).toBe(2);
});

test("hanya admin yang bisa menjalankan import", async ({ page }) => {
  // Anonim -> diarahkan ke login (proxy), jadi tidak pernah sampai ke form import.
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByTestId("import-file")).toHaveCount(0);
});
