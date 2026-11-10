import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

// Editor lineup (ticket 04, spec US-2). Test ini memakai database dev sungguhan
// dan mengatur isi member sendiri, jadi tidak bergantung pada hasil test import.

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

const AUTH_HEADERS = { apikey: PUB, "Content-Type": "application/json" };

const NAMES = [
  "E2E Alpha",
  "E2E Beta",
  "E2E Gamma",
  "E2E Delta",
  "E2E Epsilon",
  "E2E Zeta",
];

let ids: Record<string, string>;

/** Header PostgREST dengan sesi admin (token asli, bukan service role). */
async function signInAdmin(): Promise<Record<string, string>> {
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

// Satu token untuk seluruh file: password grant Supabase punya rate limit dan
// helper ini dipanggil berkali-kali dalam hitungan detik.
let adminAuth: Promise<Record<string, string>> | undefined;

function adminHeaders(): Promise<Record<string, string>> {
  adminAuth ??= signInAdmin();

  return adminAuth;
}

/** State awal: tepat 3 member tanpa slot (hapus semua member = slot ikut cascade). */
async function seedMembers(): Promise<Record<string, string>> {
  const headers = await adminHeaders();

  const removed = await fetch(`${URL}/rest/v1/guild_members?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  expect([200, 204]).toContain(removed.status);

  const res = await fetch(`${URL}/rest/v1/guild_members`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      NAMES.map((name, index) => ({
        source_id: 800 + index,
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
      })),
    ),
  });
  expect(res.status).toBe(201);

  const rows = (await res.json()) as { id: string; player_name: string }[];

  return Object.fromEntries(rows.map((row) => [row.player_name, row.id]));
}

async function readSlots() {
  const res = await fetch(`${URL}/rest/v1/lineup_slots?select=team_position,slot_no,member_id`, {
    headers: { ...AUTH_HEADERS, Authorization: AUTH_HEADERS.apikey },
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

function poolItem(page: Page, name: string) {
  return page.getByTestId("pool-member").filter({ hasText: name });
}

async function openEditor(page: Page) {
  await page.goto("/admin/lineup");
  await expect(page.getByTestId("lineup-editor-title")).toBeVisible();
}

/** Seret dengan mouse: dnd-kit butuh satu gerakan kecil dulu untuk aktivasi. */
async function drag(page: Page, source: Locator, toTestId: string) {
  const target = page.getByTestId(toTestId);
  await target.scrollIntoViewIfNeeded();

  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe.configure({ mode: "serial" });

// Satu login UI untuk seluruh file (password grant Supabase punya rate limit),
// cookie-nya dipasang ulang di context tiap test.
let sessionCookies: Awaited<ReturnType<BrowserContext["storageState"]>>["cookies"] = [];

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  sessionCookies = (await context.storageState()).cookies;
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(sessionCookies);
  ids = await seedMembers();
});

test("panel berisi seluruh member dan 12 kartu tim × 5 slot", async ({ page }) => {
  await openEditor(page);

  await expect(page.getByTestId("editor-team-card")).toHaveCount(12);
  await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(60);
  await expect(page.getByTestId("pool-member")).toHaveCount(NAMES.length);
  for (const name of NAMES) {
    await expect(poolItem(page, name)).toBeVisible();
  }
});

test("klik member lalu klik slot menempatkan member dan tersimpan otomatis", async ({
  page,
}) => {
  await openEditor(page);

  // Penanda hidup hanya bertahan kalau halaman tidak reload.
  await page.evaluate(() => ((window as unknown as { __alive?: number }).__alive = 1));

  await poolItem(page, "E2E Alpha").getByRole("button").click();
  await expect(page.getByTestId("lineup-selection")).toContainText("E2E Alpha");

  await page.getByTestId("empty-slot-1-1").click();

  await expect(page.getByTestId("slot-1-1")).toHaveAttribute("data-filled", "true");
  await expect(page.getByTestId("slot-1-1")).toContainText("E2E Alpha");
  expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);

  // Tersimpan di server tanpa tombol simpan.
  await expect
    .poll(async () => (await readSlots()).map(({ team_position, slot_no }) => `${team_position}:${slot_no}`))
    .toEqual(["1:1"]);

  // Member yang sudah punya tim tidak bisa dipakai lagi.
  await expect(poolItem(page, "E2E Alpha").getByRole("button")).toBeDisabled();
});

test("jalur keyboard: Enter di member, lalu Enter di slot kosong", async ({ page }) => {
  await openEditor(page);

  await poolItem(page, "E2E Beta").getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("lineup-selection")).toContainText("E2E Beta");

  await page.getByTestId("empty-slot-2-1").focus();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("slot-2-1")).toHaveAttribute("data-filled", "true");
  await expect(page.getByTestId("slot-2-1")).toContainText("E2E Beta");
  await expect.poll(async () => (await readSlots()).length).toBe(1);
});

test("drag member dari pool ke slot menempatkan member", async ({ page }) => {
  await openEditor(page);

  // Penanda hidup hanya bertahan kalau halaman tidak reload.
  await page.evaluate(() => ((window as unknown as { __alive?: number }).__alive = 1));

  await drag(page, poolItem(page, "E2E Gamma").getByRole("button"), "slot-3-1");

  await expect(page.getByTestId("slot-3-1")).toHaveAttribute("data-filled", "true");
  await expect(page.getByTestId("slot-3-1")).toContainText("E2E Gamma");
  expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);
  await expect
    .poll(async () =>
      (await readSlots()).map(({ team_position, slot_no }) => `${team_position}:${slot_no}`),
    )
    .toEqual(["3:1"]);
});

test("member yang sudah punya tim tidak bisa masuk tim lain", async ({ page }) => {
  const headers = await adminHeaders();
  await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      { team_position: 1, slot_no: 1, member_id: ids["E2E Alpha"] },
    ]),
  });

  await openEditor(page);

  const alpha = poolItem(page, "E2E Alpha");
  await expect(alpha).toHaveAttribute("data-assigned", "true");
  await expect(alpha.getByRole("button")).toBeDisabled();
  await expect(page.getByTestId("slot-1-1")).toContainText("E2E Alpha");
});

test("drop ke slot yang sudah terisi ditolak dengan pesan", async ({ page }) => {
  const headers = await adminHeaders();
  await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      { team_position: 1, slot_no: 1, member_id: ids["E2E Alpha"] },
    ]),
  });

  await openEditor(page);
  await drag(page, poolItem(page, "E2E Beta").getByRole("button"), "slot-1-1");

  // Slot tetap milik member lama, member yang diseret tetap di pool.
  await expect(page.getByTestId("lineup-error")).toContainText(
    "Slot sudah terisi member lain.",
  );
  await expect(page.getByTestId("slot-1-1")).toContainText("E2E Alpha");
  await expect(page.getByTestId("slot-1-1")).not.toContainText("E2E Beta");
  await expect(poolItem(page, "E2E Beta").getByRole("button")).toBeEnabled();
  await expect.poll(async () => (await readSlots()).length).toBe(1);
});

test("tim yang sudah penuh tidak menerima member baru", async ({ page }) => {
  const headers = await adminHeaders();
  // Tim 1 terisi 5 member -> tidak ada slot kosong yang bisa menerima penempatan.
  await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      NAMES.slice(0, 5).map((name, index) => ({
        team_position: 1,
        slot_no: index + 1,
        member_id: ids[name],
      })),
    ),
  });

  await openEditor(page);

  await expect(page.getByTestId("editor-team-card").first().locator('[data-testid^="empty-slot-"]')).toHaveCount(0);

  // Member ke-6 tetap ditolak walau diseret ke tim yang penuh.
  await drag(page, poolItem(page, "E2E Zeta").getByRole("button"), "slot-1-1");
  await expect(page.getByTestId("lineup-error")).toContainText(
    "Slot sudah terisi member lain.",
  );
  await expect.poll(async () => (await readSlots()).length).toBe(5);
});

test("tombol Keluarkan mengembalikan member ke pool", async ({ page }) => {
  const headers = await adminHeaders();
  await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      { team_position: 1, slot_no: 1, member_id: ids["E2E Alpha"] },
    ]),
  });

  await openEditor(page);

  await page.getByTestId("slot-1-1").getByRole("button", { name: "Keluarkan" }).click();

  await expect(page.getByTestId("slot-1-1")).toHaveAttribute("data-filled", "false");
  await expect(poolItem(page, "E2E Alpha").getByRole("button")).toBeEnabled();
  await expect.poll(async () => (await readSlots()).length).toBe(0);
});

test("error server saat member sudah punya tim ditampilkan, bukan state optimistis", async ({
  page,
}) => {
  const headers = await adminHeaders();

  await openEditor(page);

  // Admin lain menempatkan Alpha di slot 1-3 setelah halaman ini dirender.
  const post = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ team_position: 1, slot_no: 3, member_id: ids["E2E Alpha"] }]),
  });
  expect(post.status).toBe(201);

  // UI masih menganggap Alpha bebas -> server menolak dengan alasan yang jelas.
  await poolItem(page, "E2E Alpha").getByRole("button").click();
  await page.getByTestId("empty-slot-1-4").click();
  await expect(page.getByTestId("lineup-error")).toContainText(
    "Member ini sudah ada di Tim 1, slot 3.",
  );

  // UI akhirnya menampilkan keadaan sebenarnya dari server, bukan tebakan.
  await expect(page.getByTestId("slot-1-3")).toContainText("E2E Alpha");
  await expect(page.getByTestId("slot-1-4")).toHaveAttribute("data-filled", "false");
  await expect.poll(async () => (await readSlots()).length).toBe(1);
});

test("error server saat slot sudah diisi admin lain ditampilkan", async ({ page }) => {
  const headers = await adminHeaders();

  await openEditor(page);

  // Admin lain menempatkan Beta di slot 1-5 setelah halaman ini dirender.
  const post = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ team_position: 1, slot_no: 5, member_id: ids["E2E Beta"] }]),
  });
  expect(post.status).toBe(201);

  await poolItem(page, "E2E Gamma").getByRole("button").click();
  await page.getByTestId("empty-slot-1-5").click();
  await expect(page.getByTestId("lineup-error")).toContainText(
    "Slot sudah terisi member lain.",
  );

  await expect(page.getByTestId("slot-1-5")).toContainText("E2E Beta");
  await expect.poll(async () => (await readSlots()).length).toBe(1);
});
