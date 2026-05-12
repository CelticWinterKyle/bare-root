import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "perenual.com" },
      { protocol: "https", hostname: "*.perenual.com" },
    ],
  },
};

export default nextConfig;
