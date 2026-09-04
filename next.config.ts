import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Menu photos are checked against a 5MB app-level limit in
      // src/app/actions/menu.ts — this has to be at least that big (plus
      // room for multipart overhead) or Next.js rejects the upload before
      // that check ever runs, with a generic server error.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
