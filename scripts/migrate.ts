/**
 * Applies SQL migrations from ./drizzle.
 *   npm run db:migrate            → DATABASE_URL_UNPOOLED (or DATABASE_URL)
 *   npm run db:migrate -- --test  → TEST_DATABASE_URL
 * Always uses a direct connection: Neon's pooler cannot run migrations.
 */
import "./_env";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const useTest = process.argv.includes("--test");
  const url = useTest ? process.env.TEST_DATABASE_URL : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);

  if (!url) {
    console.error(`Missing ${useTest ? "TEST_DATABASE_URL" : "DATABASE_URL"}. Run \`npm run db:up\` first.`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
    const { hostname, port, pathname } = new URL(url);
    console.log(`Migrations applied to ${hostname}:${port}${pathname}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
