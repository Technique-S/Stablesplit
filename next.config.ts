import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      accounts: "./lib/wallet-empty-accounts.ts",
    },
  },
};

export default nextConfig;
