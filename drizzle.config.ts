import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const connectionString = process.env.SUPABASE_POOLER_DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
