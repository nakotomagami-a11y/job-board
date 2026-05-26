import type { NextConfig } from "next";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname);

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  distDir: ".next",
  turbopack: {
    root: PROJECT_ROOT,
  },
  serverExternalPackages: [
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "puppeteer-extra-plugin",
  ],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
