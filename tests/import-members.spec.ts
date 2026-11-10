import { expect, test, type Page } from "@playwright/test";

// Import CSV member (ticket 03). Test ini memakai database dev sungguhan:
// import bersifat replace-all, jadi isi tabel member = isi CSV.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_EMAIL / ADMIN_PASSWORD belum diisi — isi .env.local dulu (akunnya dibuat `npm run seed:admin`).",
  );
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const HEADERS = {
  apikey: PUB!,
  Authorization: `Bearer ${PUB!}`,
  "Content-Type": "application/json",
};

async function countMembers(): Promise<number> {
  const res = await fetch(`${URL}/rest/v1/guild_members?select=id`, { headers: HEADERS });
  expect(res.status).toBe(200);

  return (await res.json()).length;
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

  await page.getByTestId("import-confirm-button").click();

  await expect(page.getByTestId("import-report")).toBeVisible();
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

test("hanya admin yang bisa menjalankan import", async ({ page }) => {
  // Anonim -> diarahkan ke login (proxy), jadi tidak pernah sampai ke form import.
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByTestId("import-file")).toHaveCount(0);
});
