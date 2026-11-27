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

const status = spawnSync("npx", ["prisma", "migrate", "status"], {
  env: commandEnv,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});
emitOutput(status);

if (status.error) {
  console.error("Could not check Prisma migration status:", status.error.message);
  process.exit(1);
}

if (status.status !== 0) {
  const statusOutput = `${status.stdout || ""}\n${status.stderr || ""}`;
  const hasPendingMigrations = /have not yet been applied|not yet been applied/i.test(statusOutput);
  if (hasPendingMigrations) {
    console.error("Pending Prisma migrations detected; refusing to start. Review and apply them through the approved migration process.");
  } else {
    console.error("Prisma migration status is not clean; refusing to start the API.");
  }
  process.exit(status.status ?? 1);
}

console.info("Prisma migrations are up to date; no database changes were made.");
const api = spawnSync(process.execPath, ["dist/main.js"], {
  env: process.env,
  stdio: "inherit",
});
if (api.error) {
  console.error("Could not start the CYB API:", api.error.message);
  process.exit(1);
}
process.exit(api.status ?? 1);
