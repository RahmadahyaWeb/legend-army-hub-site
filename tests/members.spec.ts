import { expect, test, type Page } from "@playwright/test";

// Direktori member publik (ticket 07, spec US-5). Test memakai database dev
// sungguhan; sebelum test, member diganti dengan data tetap supaya urutan
// pencarian/filter/sort bisa diprediksi.

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

type SeedMember = {
  player_name: string;
  class_name: string;
  guild_rank: string;
  gear_score: number;
  weekly: number;
  weekly_contribution: number;
  total_contribution: number;
  is_online: boolean;
};

const MEMBERS: SeedMember[] = [
  {
    player_name: "Ariana",
    class_name: "Creator",
    guild_rank: "WARLORD",
    gear_score: 500,
    weekly: 7,
    weekly_contribution: 10,
    total_contribution: 100,
    is_online: true,
  },
  {
    player_name: "Mariana",
    class_name: "High Priest",
    guild_rank: "COMMANDER",
    gear_score: 300,
    weekly: 9,
    weekly_contribution: 30,
    total_contribution: 300,
    is_online: false,
  },
  {
    player_name: "Budi",
    class_name: "Alithea",
    guild_rank: "CITIZEN",
    gear_score: 400,
    weekly: 8,
    weekly_contribution: 20,
    total_contribution: 200,
    is_online: true,
  },
  {
    player_name: "Zack",
    class_name: "Creator",
    guild_rank: "CITIZEN",
    gear_score: 100,
    weekly: 1,
    weekly_contribution: 5,
    total_contribution: 50,
    is_online: false,
  },
];

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

test.beforeAll(async () => {
  const headers = await adminHeaders();

  // Replace-all: hapus member (slot ikut cascade), lalu isi data test.
  const removed = await fetch(`${URL}/rest/v1/guild_members?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  expect([200, 204]).toContain(removed.status);

  const inserted = await fetch(`${URL}/rest/v1/guild_members`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      MEMBERS.map((member, index) => ({
        ...member,
        source_id: 700 + index,
        level: 90,
        title: "Pathfinder IV",
        gender: "M",
        online_status: member.is_online ? "[Online]" : "Offline for 3 min",
      })),
    ),
  });
  expect(inserted.status).toBe(201);
  const rows = (await inserted.json()) as { id: string; player_name: string }[];

  // Budi punya slot di Tim 3 untuk membuktikan badge Lineup.
  const budi = rows.find((row) => row.player_name === "Budi")!;
  const slot = await fetch(`${URL}/rest/v1/lineup_slots`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ team_position: 3, slot_no: 1, member_id: budi.id }]),
  });
  expect(slot.status).toBe(201);
});

async function memberNames(page: Page): Promise<string[]> {
  return page.getByTestId("member-name").allTextContents();
}

test("menampilkan seluruh member, default urut gear score tertinggi", async ({
  page,
}) => {
  await page.goto("/members");

  await expect(page.getByTestId("member-row")).toHaveCount(MEMBERS.length);
  expect(await memberNames(page)).toEqual(["Ariana", "Budi", "Mariana", "Zack"]);
});

test("search nama bersifat contains dan case-insensitive", async ({ page }) => {
  await page.goto("/members?q=ARI");

  await expect(page.getByTestId("member-row")).toHaveCount(2);
  expect(await memberNames(page)).toEqual(["Ariana", "Mariana"]);
});

test("filter rank, class, dan status online dieksekusi terpisah", async ({
  page,
}) => {
  await page.goto("/members?rank=WARLORD");
  expect(await memberNames(page)).toEqual(["Ariana"]);

  await page.goto("/members?class=Creator&online=online");
  expect(await memberNames(page)).toEqual(["Ariana"]);

  await page.goto("/members?online=offline");
  expect(await memberNames(page)).toEqual(["Mariana", "Zack"]);
});

test("sort nama dan kontribusi total mengikuti arah pilihan", async ({ page }) => {
  await page.goto("/members?sort=name_desc");
  expect(await memberNames(page)).toEqual(["Zack", "Mariana", "Budi", "Ariana"]);

  await page.goto("/members?sort=total_contribution");
  expect(await memberNames(page)).toEqual(["Mariana", "Budi", "Ariana", "Zack"]);
});

test("member yang punya slot lineup diberi badge dan nama tim", async ({
  page,
}) => {
  await page.goto("/members");

  const budi = page.getByTestId("member-row").filter({ hasText: "Budi" });
  await expect(budi.getByTestId("lineup-badge")).toHaveText("Lineup · Tim 3");
  await expect(page.getByTestId("lineup-badge")).toHaveCount(1);
});

test("form menerapkan filter lewat URL dan URL itu bisa dibuka ulang", async ({
  page,
}) => {
  await page.goto("/members");

  await page.getByLabel("Cari nama").fill("ari");
  await page.getByRole("button", { name: "Terapkan" }).click();

  await expect(page).toHaveURL(/\/members\?.*q=ari/);
  expect(await memberNames(page)).toEqual(["Ariana", "Mariana"]);

  const shared = "/members?class=Creator&sort=name_desc";
  await page.goto(shared);
  await expect(page.getByTestId("member-row")).toHaveCount(2);
  expect(await memberNames(page)).toEqual(["Zack", "Ariana"]);

  await page.reload();
  expect(await memberNames(page)).toEqual(["Zack", "Ariana"]);
  await expect(page.getByLabel("Class")).toHaveValue("Creator");
  await expect(page.getByLabel("Urutkan")).toHaveValue("name_desc");
});
