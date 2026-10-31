import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must be loaded from node_modules, not bundled.
  serverExternalPackages: ["bcrypt", "better-sqlite3"],
  // Don't let `next dev` write AGENTS.md into the repo.
  agentRules: false,
};

export default nextConfig;
