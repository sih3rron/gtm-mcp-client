import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy-load database connection to ensure environment variables are loaded
let _db: ReturnType<typeof drizzle> | null = null;

function getDatabase() {
  if (_db) {
    return _db;
  }

  // Debug environment variable loading
  console.log("Environment check:", {
    NODE_ENV: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlLength: process.env.DATABASE_URL?.length || 0,
    databaseUrlStart: process.env.DATABASE_URL?.substring(0, 20) || 'NOT SET'
  });

  // Disable prefetch as it's not supported for "Transaction" pool mode
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  _db = drizzle(client, { schema });
  
  return _db;
}

export const db = getDatabase();

export * from "./schema";