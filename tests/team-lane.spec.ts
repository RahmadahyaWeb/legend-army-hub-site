import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Label lane per tim (ticket 05, spec US-3). Memakai database dev sungguhan dan
// mengatur datanya sendiri; lane dikembalikan ke default 4/4/4 sebelum & sesudah.

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

const NAMES = ["E2E Alpha", "E2E Beta", "E2E Gamma"];

let alphaId: string;

/** Header PostgREST dengan sesi admin (token asli, bukan service role). */
async function signInAdmin(): Promise<Record<string, string>> {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  expect(res.status).toBe(200);
  const { access_token } = await res.json();

  return { ...AUTH_HEADERS, Authorization: `Bearer ${access_token}` };
}

let adminAuth: Promise<Record<string, string>> | undefined;

function adminHeaders(): Promise<Record<string, string>> {
  adminAuth ??= signInAdmin();

  return adminAuth;
}

/** Seed default dari migration: tim 1–4 top, 5–8 mid, 9–12 bot. */
async function resetLanes() {
  const headers = await adminHeaders();
  const patches = [
    ["position=lte.4", "top"],
    ["position=gte.5&position=lte.8", "mid"],
    ["position=gte.9", "bot"],
  ];

  for (const [filter, lane] of patches) {
    const res = await fetch(`${URL}/rest/v1/teams?${filter}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ lane }),
    });
    expect([200, 204]).toContain(res.status);
  }
}

/** State awal: 3 member, satu di antaranya di Tim 1 slot 1 (lineup harus utuh). */
async function seedData() {
  const headers = await adminHeaders();

  const removed = await fetch(`${URL}/rest/v1/guild_members?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  expect([200, 204]).toContain(removed.status);

  const res = await fetch(`${URL}/rest/v1/guild_members`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(
      NAMES.map((name, index) => ({
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
      })),
    ),
  });
  expect(res.status).toBe(201);

  const rows = (await res.json()) as { id: string; player_name: string }[];
  alphaId = rows.find((row) => row.player_name === "E2E Alpha")!.id;

  const slot = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ team_position: 1, slot_no: 1, member_id: alphaId }]),
  });
  expect(slot.status).toBe(201);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByTestId("admin-title")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

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
  await resetLanes();
  await seedData();
});

test.afterAll(async () => {
  await resetLanes();

  const headers = await adminHeaders();
  const res = await fetch(`${URL}/rest/v1/guild_members?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  expect([200, 204]).toContain(res.status);
});

test("pindah lane satu tim mengubah jumlah per lane di halaman publik, lineup tetap utuh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("lane-count-top")).toHaveText("4 tim");
  await expect(page.getByTestId("lane-count-mid")).toHaveText("4 tim");
  await expect(page.getByTestId("lane-count-bot")).toHaveText("4 tim");

  await page.goto("/admin/lineup");
  await expect(page.getByTestId("lineup-editor-title")).toBeVisible();
  await expect(page.getByTestId("team-lane-1")).toHaveValue("top");

  // 4/4/4 -> 3/4/5: komposisi bebas, bukan error.
  await page.getByTestId("team-lane-1").selectOption("bot");
  await expect(page.getByTestId("team-lane-1")).toHaveValue("bot");
  await expect(page.getByTestId("lineup-error")).toHaveCount(0);

  // Slot tetap milik membernya di editor.
  await expect(page.getByTestId("slot-1-1")).toContainText("E2E Alpha");

  await page.goto("/");
  await expect(page.getByTestId("lane-count-top")).toHaveText("3 tim");
  await expect(page.getByTestId("lane-count-mid")).toHaveText("4 tim");
  await expect(page.getByTestId("lane-count-bot")).toHaveText("5 tim");

  // Tim 1 pindah ke grup BOT, dan lineup-nya tidak tersentuh.
  const botGroup = page.getByTestId("lane-group").filter({ hasText: "Jalur BOT" });
  await expect(botGroup.getByTestId("team-card")).toHaveCount(5);
  await expect(
    botGroup.getByTestId("team-card").filter({ has: page.getByText("Tim 1", { exact: true }) }),
  ).toContainText("E2E Alpha");

  await expect(page.getByTestId("team-card")).toHaveCount(12);
  await expect(page.getByTestId("empty-slot")).toHaveCount(59);
});
