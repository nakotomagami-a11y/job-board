import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Pin the workspace root. Without this, Turbopack walks up the tree looking
  // for a lockfile and lands on C:\Users\Saphire\yarn.lock, then tries to
  // watch/scan the entire user profile — which spawns enough worker processes
  // to OOM the machine.
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
