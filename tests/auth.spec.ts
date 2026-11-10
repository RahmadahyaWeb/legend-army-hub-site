import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error(
    "Kredensial auth belum diisi — isi ADMIN_EMAIL, ADMIN_PASSWORD, TEST_MEMBER_EMAIL, TEST_MEMBER_PASSWORD di .env.local (akunnya dibuat `npm run seed:admin`).",
  );
}

// Halaman login bisa dibuka polos (setelah logout) atau dengan ?next=...
const LOGIN_URL = /\/login(\?|$)/;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("pengunjung anonim yang membuka /admin diarahkan ke halaman login", async ({
  page,
}) => {
  // Proxy mengembalikan 307 (bukan 200) sebelum render dimulai.
  const redirect = await page.request.get("/admin", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers()["location"]).toContain("/login");

  await page.goto("/admin");
  await expect(page).toHaveURL(LOGIN_URL);
  await expect(page.getByTestId("login-title")).toBeVisible();
});

test("admin login lalu melihat area admin", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-title")).toBeVisible();
  await expect(page.getByTestId("admin-email")).toHaveText(ADMIN_EMAIL);
});

test("sesi admin bertahan setelah halaman di-refresh", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.getByTestId("admin-title")).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-title")).toBeVisible();
});

test("user login non-admin melihat 403 Forbidden", async ({ page }) => {
  await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);

  await expect(page.getByTestId("forbidden")).toBeVisible();
  await expect(page.getByText("403")).toBeVisible();

  // Status HTTP-nya juga 403, bukan 200 dengan halaman "maaf".
  const response = await page.request.get("/admin");
  expect(response.status()).toBe(403);
});

test("admin bisa keluar, lalu /admin kembali terlindungi", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.getByTestId("admin-title")).toBeVisible();

  await page.getByRole("button", { name: "Keluar" }).click();

  await expect(page).toHaveURL(LOGIN_URL);
  await page.goto("/admin");
  await expect(page).toHaveURL(LOGIN_URL);
});

test("kredensial salah ditolak dengan pesan galat", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("password-salah");
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page.getByTestId("login-error")).toBeVisible();
  await expect(page).toHaveURL(LOGIN_URL);
});

test("tidak ada halaman atau tombol registrasi di aplikasi ini", async ({
  page,
}) => {
  const signup = await page.goto("/signup");
  expect(signup?.status()).toBe(404);

  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /daftar|register|signup/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /daftar|register|signup/i }),
  ).toHaveCount(0);
});

test.fixme(
  "endpoint signup Supabase harus ditutup (Auth > Sign In / Providers > Email > Enable sign-ups = OFF)",
  async ({ request }) => {
    const settings = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    );

    expect((await settings.json()).disable_signup).toBe(true);
  },
);
