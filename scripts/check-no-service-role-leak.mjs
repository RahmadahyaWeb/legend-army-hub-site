// Bukti bahwa service-role key tidak pernah sampai ke bundle client.
// Spec: .scratch/guild-league-lineup/spec.md §4.5 (SUPABASE_SERVICE_ROLE_KEY
// hanya boleh di environment server).
//
// Pakai: npm run build && npm run check:leak

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const BUILD_DIR = ".next";
const CLIENT_DIR = join(BUILD_DIR, "static");
const KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local opsional — env dari shell yang dipakai.
}

if (!existsSync(BUILD_DIR)) {
  console.error(`${BUILD_DIR} belum ada — jalankan \`npm run build\` dulu.`);
  process.exit(1);
}

const keyValue = process.env[KEY_NAME] ?? "";

function collectFiles(dir) {
  if (!existsSync(dir)) return [];

  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function findHits(files, needle) {
  const hits = [];

  for (const file of files) {
    if (statSync(file).size > MAX_FILE_BYTES) continue;

    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (content.includes(needle)) hits.push(relative(process.cwd(), file));
  }

  return hits;
}

const clientFiles = collectFiles(CLIENT_DIR);
const allFiles = collectFiles(BUILD_DIR);

const leaks = [];

if (keyValue) {
  for (const file of findHits(allFiles, keyValue)) {
    leaks.push(`${file} (isi ${KEY_NAME})`);
  }
} else {
  console.warn(
    `PERINGATAN: ${KEY_NAME} kosong di env — nilai kunci tidak bisa diperiksa.`,
  );
}

for (const file of findHits(clientFiles, KEY_NAME)) {
  leaks.push(`${file} (nama env ${KEY_NAME} di bundle client)`);
}

if (leaks.length > 0) {
  console.error(`GAGAL: ${KEY_NAME} bocor ke build output:`);
  for (const leak of leaks) console.error(`  - ${leak}`);
  process.exit(1);
}

console.log(
  `OK: tidak ada ${KEY_NAME} di ${BUILD_DIR} (${clientFiles.length} file bundle client diperiksa).`,
);
