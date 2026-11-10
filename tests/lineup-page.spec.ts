import { expect, test } from "@playwright/test";

test("halaman publik menampilkan 12 tim dan 60 slot kosong tanpa login", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Legend Army");
  await expect(page.getByTestId("team-card")).toHaveCount(12);
  await expect(page.getByTestId("empty-slot")).toHaveCount(60);
  await expect(page.getByTestId("empty-slot").first()).toContainText("Kosong");
  await expect(page.getByTestId("lane-group")).toHaveCount(3);
});
