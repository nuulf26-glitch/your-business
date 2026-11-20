const { spawnSync } = require("node:child_process");
const { directMigrationDatabaseUrl } = require("./migration-url.cjs");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to start the API.");
  process.exit(1);
}

let migrationUrl;
try {
  migrationUrl = directMigrationDatabaseUrl(databaseUrl);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid DATABASE_URL.");
  process.exit(1);
}

const migration = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: migrationUrl },
  stdio: "inherit",
});
if (migration.error) {
  console.error("Could not start Prisma migration:", migration.error.message);
  process.exit(1);
}
if (migration.status !== 0) process.exit(migration.status ?? 1);

const api = spawnSync(process.execPath, ["dist/main.js"], {
  env: process.env,
  stdio: "inherit",
});
if (api.error) {
  console.error("Could not start the CYB API:", api.error.message);
  process.exit(1);
}
process.exit(api.status ?? 1);
