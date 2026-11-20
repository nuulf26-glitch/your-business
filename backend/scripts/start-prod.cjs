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

const maxAttempts = 4;
let migration;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  migration = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: migrationUrl },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (migration.stdout) process.stdout.write(migration.stdout);
  if (migration.stderr) process.stderr.write(migration.stderr);
  if (migration.error) {
    console.error("Could not start Prisma migration:", migration.error.message);
    process.exit(1);
  }
  if (migration.status === 0) break;

  const output = `${migration.stdout || ""}\n${migration.stderr || ""}`;
  const lockTimeout = /P1002[\s\S]*?advisory lock|Timed out trying to acquire a postgres advisory lock/i.test(output);
  if (!lockTimeout || attempt === maxAttempts) process.exit(migration.status ?? 1);

  console.warn(`Prisma advisory lock is busy; retrying migration deploy (${attempt + 1}/${maxAttempts}).`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 10_000);
}

const api = spawnSync(process.execPath, ["dist/main.js"], {
  env: process.env,
  stdio: "inherit",
});
if (api.error) {
  console.error("Could not start the CYB API:", api.error.message);
  process.exit(1);
}
process.exit(api.status ?? 1);
