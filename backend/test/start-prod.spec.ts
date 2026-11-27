import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const startupScript = path.resolve(process.cwd(), "scripts/start-prod.cjs");
const testDatabaseUrl = "postgresql://test_user:test-secret@localhost:5432/test_db";

function runStartup(statusCode: number, statusOutput: string) {
  const workDir = mkdtempSync(path.join(tmpdir(), "cyb-startup-"));
  const binDir = path.join(workDir, "bin");
  const distDir = path.join(workDir, "dist");
  const callsFile = path.join(workDir, "commands.log");
  mkdirSync(binDir);
  mkdirSync(distDir);
  writeFileSync(path.join(distDir, "main.js"), "process.stdout.write('API_TEST_STARTED\\n');\n");
  const npxShim = path.join(binDir, "npx");
  writeFileSync(npxShim, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MOCK_CALL_LOG\"\nprintf '%s' \"$MOCK_STATUS_OUTPUT\"\nexit \"$MOCK_STATUS_CODE\"\n");
  chmodSync(npxShim, 0o755);

  const result = spawnSync(process.execPath, [startupScript], {
    cwd: workDir,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      PATH: binDir + ":" + (process.env.PATH || ""),
      MOCK_CALL_LOG: callsFile,
      MOCK_STATUS_CODE: String(statusCode),
      MOCK_STATUS_OUTPUT: statusOutput,
    },
  });
  const calls = readFileSync(callsFile, "utf8").trim().split("\n");
  rmSync(workDir, { recursive: true, force: true });
  return { ...result, calls };
}

describe("production startup migration safety", () => {
  it("refuses to start when migrations are pending and never runs migrate deploy", () => {
    const result = runStartup(1, "Following migrations have not yet been applied:\n20261127000000_example\n");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Pending Prisma migrations detected; refusing to start");
    expect(result.calls).toEqual(["prisma migrate status"]);
    expect(result.stdout + "\n" + result.stderr).not.toContain("test-secret");
  });

  it("starts the API only after a clean migration status without changing the database", () => {
    const result = runStartup(0, "Prisma schema is up to date!\n");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("API_TEST_STARTED");
    expect(result.calls).toEqual(["prisma migrate status"]);
  });
});
