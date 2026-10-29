import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Guides are read from disk at request time; ship them with the server functions.
  outputFileTracingIncludes: { "/**": ["./data/guides/**"] },
  /* config options here */
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
