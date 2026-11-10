import { expect, test } from "@playwright/test";

test("halaman publik menampilkan 12 tim dan 5 slot per tim tanpa login", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Legend Army");
  await expect(page.getByTestId("team-card")).toHaveCount(12);
  await expect(page.getByTestId("lineup-slot")).toHaveCount(60);
  await expect(page.getByTestId("lane-group")).toHaveCount(3);
});

test("slot yang belum terisi diberi label Kosong", async ({ page }) => {
  await page.goto("/");

  const emptySlots = page.getByTestId("empty-slot");
  await expect(emptySlots.first()).toBeVisible();

  const labels = await emptySlots.allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => label.includes("Kosong"))).toBe(true);
});
