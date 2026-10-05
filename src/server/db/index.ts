import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/*
 * One small pool per server instance. In production DATABASE_URL is Neon's
 * POOLED url (PgBouncer, transaction mode), so: no session-level SET, no
 * LISTEN/NOTIFY, no named prepared statements — use SET LOCAL and
 * transaction-scoped advisory locks only.
 *
 * NOTE: this module is loaded by CLIs (auth schema generator, tsx scripts),
 * so it must not import "server-only".
 */
const globalForDb = globalThis as unknown as { __taxkathaPool?: Pool };

/** Connections per server instance: small in production (Neon's pooler sits behind it), roomier for local development and tests. */
function poolSize(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured > 0 && configured <= 50) return configured;
  return process.env.NODE_ENV === "production" ? 5 : 10;
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: poolSize(),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
  });
  // An idle connection can be closed by the server (Neon scales to zero, a
  // database restart). Without a listener that error would crash the process;
  // the pool simply opens a fresh connection on the next query.
  pool.on("error", (error) => {
    console.warn("[db] idle connection closed:", error.message);
  });
  // Vercel Fluid compute: release idle connections before the instance suspends.
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}

export const pool = (globalForDb.__taxkathaPool ??= createPool());

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export type Db = typeof db;
/** A transaction handle or the root db — accepted by helpers that run inside either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export { schema };
