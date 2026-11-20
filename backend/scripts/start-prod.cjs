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

const commandEnv = { ...process.env, DATABASE_URL: migrationUrl };
const redactConnectionStrings = (value) => value.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[DATABASE_URL REDACTED]");
const emitOutput = (result) => {
  if (result.stdout) process.stdout.write(redactConnectionStrings(result.stdout));
  if (result.stderr) process.stderr.write(redactConnectionStrings(result.stderr));
};
const runPrisma = (command) => spawnSync("npx", ["prisma", "migrate", command], {
  env: commandEnv,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});

const status = runPrisma("status");
emitOutput(status);
if (status.error) {
  console.error("Could not check Prisma migration status:", status.error.message);
  process.exit(1);
}

if (status.status !== 0) {
  const statusOutput = `${status.stdout || ""}\n${status.stderr || ""}`;
  const hasPendingMigrations = /have not yet been applied|not yet been applied/i.test(statusOutput);
  if (!hasPendingMigrations) {
    console.error("Prisma migration status is not clean; refusing to start the API or modify the database.");
    process.exit(status.status ?? 1);
  }

  const maxAttempts = 4;
  let migration;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    migration = runPrisma("deploy");
    emitOutput(migration);
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
} else {
  console.info("Prisma migrations are up to date; skipping migration deploy.");
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
