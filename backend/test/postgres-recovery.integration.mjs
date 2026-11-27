import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const started = performance.now();
const url = process.env.DATABASE_URL;
if (process.env.CYB_RECOVERY_TEST !== 'true' || !url) throw new Error('Recovery integration tests require the explicit disposable CI guard and DATABASE_URL.');
const sourceUrl = new URL(url);
if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(sourceUrl.hostname) || decodeURIComponent(sourceUrl.pathname.slice(1)) !== 'cyb_recovery_source') {
  throw new Error('Recovery integration test refused a non-disposable source database.');
}
process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const pgEnv = {
  ...process.env,
  PGHOST: sourceUrl.hostname,
  PGPORT: sourceUrl.port || '5432',
  PGDATABASE: decodeURIComponent(sourceUrl.pathname.slice(1)),
  PGUSER: decodeURIComponent(sourceUrl.username),
  PGPASSWORD: decodeURIComponent(sourceUrl.password),
  PGSSLMODE: sourceUrl.searchParams.get('sslmode') || 'prefer',
};
const run = (cmd, args, env = pgEnv, expectSuccess = true) => {
  const result = spawnSync(cmd, args, { env, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
  if (expectSuccess ? result.status !== 0 : result.status === 0) {
    // Recovery CLI errors are intentionally generic and contain no SQL, connection strings, or records.
    const safeFailure = String(result.stderr || '').trim().slice(0, 1000);
    throw new Error(`${cmd} returned an unexpected result.${safeFailure ? ` ${safeFailure}` : ''}`);
  }
  return result;
};
const script = (...args) => run(process.execPath, ['scripts/postgres-recovery.mjs', ...args], process.env);
const workDir = await mkdtemp(path.join(os.tmpdir(), 'cyb-recovery-test-'));
await chmod(workDir, 0o700);
const backupFile = path.join(workDir, 'synthetic-backup.cybpg');
const restoreName = `cyb_recovery_restore_${process.env.GITHUB_RUN_ID || process.pid}`.slice(0, 60);
const restoreUrl = new URL(url);
restoreUrl.pathname = `/${restoreName}`;
const restoreEnv = {
  ...pgEnv,
  PGDATABASE: restoreName,
  DATABASE_URL: restoreUrl.toString(),
  CYB_RESTORE_CONFIRM_DATABASE: restoreName,
};
let source;
let restored;
let targetCreated = false;

try {
  source = new PrismaClient({ datasources: { db: { url } } });
  const merchantA = await source.user.create({ data: { id: 'recovery-user-a', email: 'owner-a@example.test', fullName: 'Synthetic Owner A' } });
  const merchantB = await source.user.create({ data: { id: 'recovery-user-b', email: 'owner-b@example.test', fullName: 'Synthetic Owner B' } });
  const businessA = await source.business.create({ data: { id: 'recovery-business-a', ownerId: merchantA.id, name: 'Synthetic A', slug: 'synthetic-a' } });
  const businessB = await source.business.create({ data: { id: 'recovery-business-b', ownerId: merchantB.id, name: 'Synthetic B', slug: 'synthetic-b' } });
  const website = await source.website.create({ data: { id: 'recovery-website-a', businessId: businessA.id, draft: { title: 'Synthetic draft A' }, published: { title: 'Synthetic published A' }, revision: 4 } });
  const productA = await source.product.create({ data: { id: 'recovery-product-a', businessId: businessA.id, name: 'Synthetic product A', data: { price: 1000 } } });
  await source.product.create({ data: { id: 'recovery-product-b', businessId: businessB.id, name: 'Synthetic product B', data: { price: 2000 } } });
  await source.customer.create({ data: { id: 'recovery-customer-a', businessId: businessA.id, data: { email: 'customer-a@example.test' } } });
  await source.order.create({ data: { id: 'recovery-order-a', businessId: businessA.id, status: 'paid', amountCents: 1000, currency: 'AED', data: { fixture: 'synthetic-a' } } });
  await source.order.create({ data: { id: 'recovery-order-b', businessId: businessB.id, status: 'pending', amountCents: 2000, currency: 'AED', data: { fixture: 'synthetic-b' } } });

  run('createdb', [restoreName], pgEnv);
  targetCreated = true;
  script('backup', backupFile);
  script('verify', backupFile);

  const encrypted = await readFile(backupFile);
  const flipped = Buffer.from(encrypted);
  flipped[flipped.length - 1] ^= 0x01;
  const corruptPath = path.join(workDir, 'corrupt.cybpg');
  const truncatedPath = path.join(workDir, 'truncated.cybpg');
  await writeFile(corruptPath, flipped, { mode: 0o600 });
  await writeFile(truncatedPath, encrypted.subarray(0, Math.max(0, encrypted.length - 12)), { mode: 0o600 });
  run(process.execPath, ['scripts/postgres-recovery.mjs', 'verify', corruptPath], process.env, false);
  run(process.execPath, ['scripts/postgres-recovery.mjs', 'verify', truncatedPath], process.env, false);

  // Restoring to an existing, populated database is always refused.
  run(process.execPath, ['scripts/postgres-recovery.mjs', 'restore', backupFile], { ...pgEnv, DATABASE_URL: url, CYB_RESTORE_CONFIRM_DATABASE: 'cyb_recovery_source' }, false);
  // An exact confirmation is required even for an empty target.
  run(process.execPath, ['scripts/postgres-recovery.mjs', 'restore', backupFile], { ...restoreEnv, CYB_RESTORE_CONFIRM_DATABASE: 'wrong-target' }, false);
  run(process.execPath, ['scripts/postgres-recovery.mjs', 'restore', backupFile], restoreEnv);
  await source.$disconnect();
  source = undefined;

  restored = new PrismaClient({ datasources: { db: { url: restoreUrl.toString() } } });
  const ownerA = await restored.user.findUnique({ where: { id: 'recovery-user-a' }, include: { businesses: { include: { website: true, products: true, customers: true, orders: true } } } });
  const ownerB = await restored.user.findUnique({ where: { id: 'recovery-user-b' }, include: { businesses: { include: { products: true, orders: true } } } });
  assert.equal(ownerA?.businesses.length, 1, 'owner A and business relation survived');
  assert.equal(ownerA.businesses[0].website?.id, website.id, 'website relation and JSON content survived');
  assert.equal(ownerA.businesses[0].website?.revision, 4, 'website schema fields survived');
  assert.equal(ownerA.businesses[0].products[0]?.id, productA.id, 'product relation survived');
  assert.equal(ownerA.businesses[0].customers.length, 1, 'customer relation survived');
  assert.equal(ownerA.businesses[0].orders[0]?.amountCents, 1000, 'order fields survived');
  assert.equal(ownerB?.businesses.length, 1, 'owner B relation survived');
  assert.equal(ownerB.businesses[0].products.length, 1, 'merchant B data remained present');
  assert.equal(await restored.product.findFirst({ where: { id: 'recovery-product-a', businessId: 'recovery-business-b' } }), null, 'merchant A data remains isolated from merchant B queries');
  assert.equal(await restored.order.findFirst({ where: { id: 'recovery-order-a', businessId: 'recovery-business-b' } }), null, 'merchant A orders remain isolated from merchant B queries');
  const migrationRows = await restored.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations"`;
  assert.ok(migrationRows[0].count > 0, 'Prisma migration history survived the backup');

  console.log(`PostgreSQL recovery integration passed: synthetic rows, relations, tenant isolation, schema history, tamper/truncation rejection; recovery_seconds=${((performance.now() - started) / 1000).toFixed(2)}.`);
} finally {
  await source?.$disconnect();
  await restored?.$disconnect();
  if (targetCreated) {
    try { run('dropdb', ['--if-exists', restoreName], pgEnv); } catch { /* The CI service is disposable and is torn down with the job. */ }
  }
  await rm(workDir, { recursive: true, force: true });
}
