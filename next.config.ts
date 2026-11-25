import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev overlay badge out of demo screenshots.
  devIndicators: false,
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
