import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for @arcgis/core — ships ES modules with CSS imports
  transpilePackages: ["@arcgis/core"],
  allowedDevOrigins: ["*"],
};

export default nextConfig;

