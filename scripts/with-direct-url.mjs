import { spawnSync } from "node:child_process";

function read(name) {
  const value = process.env[name]?.trim();
  return value || "";
}

const direct =
  read("PSQL_DATABASE_POSTGRES_URL") ||
  read("PSQL_DATABASE_PRISMA_DATABASE_URL") ||
  read("DATABASE_URL") ||
  read("PSQL_DATABASE_DATABASE_URL_POOLED");

if (!direct) {
  console.error(
    "No database URL found. Set DATABASE_URL, or the PSQL_DATABASE_ variables from the Vercel Prisma Postgres integration.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Pass the command to run, for example: prisma migrate deploy");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: direct },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
