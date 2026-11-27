import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, link, mkdir, mkdtemp, open, readFile, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MAGIC = Buffer.from('CYBPG01\n');
const DEFAULT_BACKUP_DIR = path.resolve('private-backups/postgres');
const KEY_ENV = 'BACKUP_ENCRYPTION_KEY';
const SAFE_SUCCESS = {
  backup: 'Encrypted PostgreSQL backup created and verified.',
  verify: 'Encrypted PostgreSQL backup integrity and archive structure verified.',
  restore: 'PostgreSQL restore completed into an empty, explicitly confirmed database.',
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readKey() {
  const value = process.env[KEY_ENV] || '';
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error(`${KEY_ENV} must encode exactly 32 bytes (hex or base64).`);
  return key;
}

function connectionEnv(urlValue) {
  if (!urlValue) throw new Error('DATABASE_URL is required.');
  const url = new URL(urlValue);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL must name a database.');
  const query = url.searchParams;
  const env = { ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: database,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: query.get('sslmode') || 'prefer',
  };
  return { env, database };
}

function run(command, args, env, input) {
  const result = spawnSync(command, args, {
    env,
    input,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    // PostgreSQL client diagnostics can contain query text or connection data.
    throw new Error(`${command} failed. Check private operator logs for the underlying cause.`);
  }
  return result.stdout || '';
}

function encrypt(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(archive, key) {
  const minimum = MAGIC.length + 12 + 16 + 1;
  if (archive.length < minimum || !archive.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Backup file is incomplete or has an unsupported format.');
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + 12;
  const ciphertextStart = tagStart + 16;
  const decipher = createDecipheriv('aes-256-gcm', key, archive.subarray(ivStart, tagStart));
  decipher.setAuthTag(archive.subarray(tagStart, ciphertextStart));
  try {
    return Buffer.concat([decipher.update(archive.subarray(ciphertextStart)), decipher.final()]);
  } catch {
    throw new Error('Backup authentication failed; the file or encryption key is invalid.');
  }
}

async function privateTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cyb-pg-recovery-'));
  await chmod(dir, 0o700);
  return dir;
}

async function writePrivateFile(file, content) {
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}

async function writeAtomicPrivateFile(file, content) {
  const parent = path.dirname(file);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await chmod(parent, 0o700);
  const temp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writePrivateFile(temp, content);
    // link() fails if the destination already exists; never silently replace a backup.
    await link(temp, file);
    await chmod(file, 0o600);
  } finally {
    await unlink(temp).catch(() => {});
  }
}

async function inspectArchive(archiveFile, key) {
  const dir = await privateTempDir();
  const dump = path.join(dir, 'database.dump');
  try {
    const archive = await readFile(archiveFile);
    const plain = decrypt(archive, key);
    await writePrivateFile(dump, plain);
    run('pg_restore', ['--list', dump], process.env);
    return { bytes: archive.length, sha256: createHash('sha256').update(archive).digest('hex'), dump };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

async function cleanupInspect(result) {
  if (result?.dump) await rm(path.dirname(result.dump), { recursive: true, force: true });
}

async function backup(outputFile) {
  const key = readKey();
  const connection = connectionEnv(process.env.DATABASE_URL);
  const target = path.resolve(outputFile || path.join(DEFAULT_BACKUP_DIR, `cyb-postgres-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '')}.cybpg`));
  const dir = await privateTempDir();
  const dump = path.join(dir, 'database.dump');
  try {
    run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', dump], connection.env);
    await chmod(dump, 0o600);
    run('pg_restore', ['--list', dump], process.env);
    const plain = await readFile(dump);
    await writeAtomicPrivateFile(target, encrypt(plain, key));
    let result;
    try {
      result = await inspectArchive(target, key);
      console.log(`${SAFE_SUCCESS.backup} bytes=${(await stat(target)).size} sha256=${result.sha256}`);
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    } finally {
      await cleanupInspect(result);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function verify(archiveFile) {
  if (!archiveFile) throw new Error('Provide a backup file to verify.');
  const result = await inspectArchive(path.resolve(archiveFile), readKey());
  await cleanupInspect(result);
  console.log(`${SAFE_SUCCESS.verify} bytes=${result.bytes} sha256=${result.sha256}`);
}

async function databaseIsEmpty(connection) {
  const query = "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')";
  const output = run('psql', ['--no-psqlrc', '--tuples-only', '--no-align', '--command', query], connection.env).trim();
  return output === '0';
}

async function restore(archiveFile) {
  if (!archiveFile) throw new Error('Provide a backup file to restore.');
  const key = readKey();
  const connection = connectionEnv(process.env.DATABASE_URL);
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/.test(connection.database)) throw new Error('Restore target database name is not safe to confirm.');
  if (process.env.CYB_RESTORE_CONFIRM_DATABASE !== connection.database) {
    throw new Error('Restore refused. Set CYB_RESTORE_CONFIRM_DATABASE to the exact empty target database name.');
  }
  if (!await databaseIsEmpty(connection)) throw new Error('Restore refused. The target database is not empty; restore into a new database.');
  const result = await inspectArchive(path.resolve(archiveFile), key);
  try {
    run('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', result.dump], {
      ...connection.env,
      PGDATABASE: connection.database,
    });
    // pg_restore receives connection settings via libpq environment; do not put a URL or password in argv.
    console.log(`${SAFE_SUCCESS.restore} sha256=${result.sha256}`);
  } finally {
    await cleanupInspect(result);
  }
}

async function main() {
  const [command, file] = process.argv.slice(2);
  if (!['backup', 'verify', 'restore'].includes(command)) throw new Error('Usage: postgres-recovery.mjs <backup|verify|restore> [backup-file]');
  if (command === 'backup') await backup(file);
  if (command === 'verify') await verify(file);
  if (command === 'restore') await restore(file);
}

main().catch((error) => fail(error instanceof Error ? error.message : 'PostgreSQL recovery operation failed.'));
