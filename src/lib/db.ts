import "server-only";
import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { __pgPool?: Pool };

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return new Pool({
    connectionString,
    max: 5,
    ssl: /sslmode=require|neon\.tech|supabase/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalForPg.__pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;

export async function q<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
