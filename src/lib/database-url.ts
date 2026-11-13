function read(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

// The Vercel storage integration prefixes Prisma Postgres variables with
// PSQL_DATABASE_. The pooled host is for the app. The direct host is for migrations.
export function pooledDatabaseUrl() {
  return (
    read("PSQL_DATABASE_DATABASE_URL_POOLED") ||
    read("DATABASE_URL_POOLED") ||
    read("PSQL_DATABASE_POSTGRES_URL") ||
    read("PSQL_DATABASE_PRISMA_DATABASE_URL") ||
    read("DATABASE_URL")
  );
}

export function directDatabaseUrl() {
  return (
    read("PSQL_DATABASE_POSTGRES_URL") ||
    read("PSQL_DATABASE_PRISMA_DATABASE_URL") ||
    read("DATABASE_URL") ||
    read("PSQL_DATABASE_DATABASE_URL_POOLED")
  );
}
