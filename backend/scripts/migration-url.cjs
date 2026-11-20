function directMigrationDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }

  // Neon uses the -pooler endpoint for application traffic. Prisma Migrate
  // needs a direct session so its PostgreSQL advisory lock remains held.
  if (url.hostname.endsWith(".neon.tech") && url.hostname.includes("-pooler.")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
  }

  return url.toString();
}

module.exports = { directMigrationDatabaseUrl };
