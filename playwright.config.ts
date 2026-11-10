import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// .env.local dipakai test RLS (kunci anon) — dimuat tanpa dependency tambahan.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Semua spec memakai satu database dev yang sama dan import bersifat
  // replace-all: menjalankan spec paralel membuat data saling menimpa.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
