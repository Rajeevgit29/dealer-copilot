/* Apply db/migrations/*.sql in order. Usage: npm run db:migrate */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await client.query("begin");
    await client.query(readFileSync(join(dir, file), "utf8"));
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("applied", file);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
