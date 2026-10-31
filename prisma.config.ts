import "dotenv/config";
import { defineConfig } from "prisma/config";

// The app connects through Supabase's pooler (DATABASE_URL, see lib/db.ts).
// Migrations need a direct connection, so the CLI uses DIRECT_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
