const { directMigrationDatabaseUrl } = require("../scripts/migration-url.cjs");

describe("directMigrationDatabaseUrl", () => {
  it("uses the direct Neon host for Prisma migrations and preserves connection details", () => {
    const result = directMigrationDatabaseUrl(
      "postgresql://qa_user:qa_password@ep-example-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10",
    );
    const url = new URL(result);

    expect(url.hostname).toBe("ep-example.c-7.eu-central-1.aws.neon.tech");
    expect(url.username).toBe("qa_user");
    expect(url.password).toBe("qa_password");
    expect(url.pathname).toBe("/neondb");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connect_timeout")).toBe("10");
  });

  it("leaves direct Neon and Render PostgreSQL URLs unchanged", () => {
    const direct = "postgresql://qa_user:qa_password@ep-example.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    const render = "postgresql://qa_user:qa_password@dpg-example.render.com/cyb_prod?sslmode=require";

    expect(directMigrationDatabaseUrl(direct)).toBe(new URL(direct).toString());
    expect(directMigrationDatabaseUrl(render)).toBe(new URL(render).toString());
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() => directMigrationDatabaseUrl("mysql://localhost/db")).toThrow("DATABASE_URL must use PostgreSQL.");
  });
});
