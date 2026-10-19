import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

// `generate` never connects, so a placeholder keeps it usable before DATABASE_URL exists.
export default defineConfig({
  out: "./lib/db/migrations",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
