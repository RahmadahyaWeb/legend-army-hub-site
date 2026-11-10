import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // `forbidden()` untuk user login yang bukan admin (status HTTP 403).
    authInterrupts: true,
    serverActions: {
      // Import CSV menerima file sampai 5 MB (spec §4.3); batas default 1 MB
      // akan menolak file yang sah. Sisakan ruang untuk overhead multipart.
      bodySizeLimit: "6mb",
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
