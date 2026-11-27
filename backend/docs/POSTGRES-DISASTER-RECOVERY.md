# PostgreSQL backup and recovery

CYB PostgreSQL backups are custom-format `pg_dump` archives encrypted with AES-256-GCM. The encrypted header records the PostgreSQL major version; backup and restore refuse a client/server version mismatch and restore refuses a database major-version mismatch. Use matching `pg_dump`/`pg_restore` client tools for the database major version. The encryption key is supplied outside the repository through `BACKUP_ENCRYPTION_KEY` (32 bytes encoded as hexadecimal or base64). Keep the key in the approved secret manager separately from the encrypted archive. Never print it, place it in command arguments, commit it, or upload plaintext dumps as CI artifacts.

The scripts require PostgreSQL client tools (`pg_dump`, `pg_restore`, and `psql`). They read connection details from `DATABASE_URL`; credentials are passed to libpq through process environment and are not included in command arguments or success output.

## Create and check a backup

Run from `backend/` in a trusted operator environment with secure access to the selected database:

```sh
npm run backup:postgres -- /secure/private/path/cyb-2026-11-27.cybpg
npm run verify:postgres-backup -- /secure/private/path/cyb-2026-11-27.cybpg
```

The backup command refuses to overwrite an existing file. It creates private directories and files (`0700` and `0600`), validates the PostgreSQL archive structure, encrypts it, then reopens and verifies the encrypted result. Verification checks the encryption authentication tag and parses the entire custom archive directory. It reports the encrypted-file SHA-256 and byte size only; it does not report database records, names, SQL, or credentials.

Store a second copy in the approved encrypted backup location, retain the encryption key separately, and record the checksum and retention date in the operational inventory. A checksum is useful for transfer checks; the GCM authentication tag detects unauthorized modification and a wrong key.

## Restore without overwriting a database

1. Identify the exact backup and key from the protected inventory. Verify the backup before restoration.
2. Provision a **new, empty, isolated PostgreSQL database** that matches the CYB PostgreSQL major version. Do not restore over the current database.
3. Point `DATABASE_URL` to that empty target and set `CYB_RESTORE_CONFIRM_DATABASE` to the exact database name from the URL. The restore command refuses a mismatch or any target containing tables, views, sequences, or foreign tables.
4. Restore and then validate migration history, application health, merchant ownership, publishing, and payment/order records using approved isolated checks.
5. Keep the original database untouched until the restored target has passed the required verification and cutover is explicitly authorized.

```sh
npm run verify:postgres-backup -- /secure/private/path/cyb-2026-11-27.cybpg
CYB_RESTORE_CONFIRM_DATABASE=cyb_recovery_target \
  npm run restore:postgres -- /secure/private/path/cyb-2026-11-27.cybpg
```

`DATABASE_URL` and `BACKUP_ENCRYPTION_KEY` must already be supplied through the secure operator environment. The restore command does not run Prisma migrations, drop a database, or overwrite existing objects. A schema migration after a restore is a separate change and must follow the release's migration approval procedure.

## Failure handling and rollback

- A truncated file, unsupported header, modified ciphertext, or incorrect key fails verification before a database connection is used for restore.
- A PostgreSQL archive that cannot be parsed fails `pg_restore --list` before restoration begins.
- A restore error exits non-zero with a generic message so database details do not leak into CI or shared logs. Inspect protected operator logs, preserve the original source, and restore again into another newly provisioned empty target after correcting the issue.
- Do not point the application at a partially restored target. Validate it independently first.
- If an authorized cutover fails, restore the prior application connection configuration and redeploy/roll back the application through the normal release process. Keep both database instances intact until reconciliation is complete; do not delete or overwrite the source as part of rollback.

## Automated verification

The `PostgreSQL recovery regression` GitHub Actions workflow creates a disposable PostgreSQL 16 service with matching client tools, applies the repository Prisma migrations to that disposable service, and inserts only synthetic `example.test` rows. It encrypts and verifies a backup, restores into a new empty database, checks user/business/website/product/customer/order relationships and merchant-scoped queries, checks Prisma migration history, and confirms that tampered, truncated, unconfirmed-target, and populated-target recovery attempts are rejected. The workflow creates no downloadable backup artifact and tears down the service with the job.

These tests prove recovery behavior for synthetic data and the tested schema revision. They do **not** establish recoverability of any existing CYB customer data, a provider-managed backup, retention settings, point-in-time recovery, encryption-key custody, or an infrastructure-level restore drill. Those remain separate launch checks.
