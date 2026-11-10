import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // `forbidden()` untuk user login yang bukan admin (status HTTP 403).
    authInterrupts: true,
    serverActions: {
      // Import CSV menerima file sampai 5 MB (spec §4.3); batas default 1 MB
      // akan menolak file yang sah. Batas ini untuk request body (multipart +
      // base64 ≈ 1.37× ukuran file), jadi dibuat 8mb supaya file > 5 MB
      // sampai ke server dan ditolak dengan pesan yang jelas, bukan 413 mentah.
      bodySizeLimit: "8mb",
    },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
