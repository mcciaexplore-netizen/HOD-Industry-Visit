import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

// Created lazily so `next build` can import route modules without DATABASE_URL.
function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  // prepare: false is required by Supabase's transaction pooler (port 6543).
  // A small pool suits serverless functions, which each hold their own.
  cached = drizzle(postgres(url, { prepare: false, max: 3 }), { schema });
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
