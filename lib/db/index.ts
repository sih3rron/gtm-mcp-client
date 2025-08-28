import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Debug environment variable loading
console.log("Environment check:", {
  NODE_ENV: process.env.NODE_ENV,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  databaseUrlLength: process.env.DATABASE_URL?.length || 0,
  databaseUrlStart: process.env.DATABASE_URL?.substring(0, 20) || 'undefined'
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Please check your .env file.");
}

// Disable prefetch as it's not supported for "Transaction" pool mode
const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });

export * from "./schema";