import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must be loaded from node_modules, not bundled.
  serverExternalPackages: ["bcrypt", "pg", "pdf-parse", "@napi-rs/canvas"],
  // Don't let `next dev` write AGENTS.md into the repo.
  agentRules: false,
  experimental: {
    // Set by the Next.js security upgrade (16.4.3 → 16.4.6).
    agentUpgrade: "security",
  },
};

export default nextConfig;
