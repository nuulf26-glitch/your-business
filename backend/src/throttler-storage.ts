import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { DbService } from './database';

type ThrottleRow = { totalHits: number; expiresAt: Date; blockedUntil: Date | null };
type ThrottlerRecord = { totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number };

/** PostgreSQL-backed windows keep sensitive endpoint limits consistent across API replicas. */
@Injectable()
export class DatabaseThrottlerStorage implements ThrottlerStorage {
  private callsSinceCleanup = 0;

  constructor(private readonly db: DbService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerRecord> {
    const id = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');
    const ttlMs = Math.max(1, Math.trunc(ttl));
    const blockMs = Math.max(0, Math.trunc(blockDuration));
    const rows = await this.db.$queryRaw<ThrottleRow[]>`
      INSERT INTO "ApiThrottleBucket" ("id", "totalHits", "expiresAt", "blockedUntil", "updatedAt")
      VALUES (${id}, 1, clock_timestamp() + (${ttlMs} * interval '1 millisecond'), NULL, clock_timestamp())
      ON CONFLICT ("id") DO UPDATE SET
        "totalHits" = CASE
          WHEN "ApiThrottleBucket"."blockedUntil" > clock_timestamp() THEN "ApiThrottleBucket"."totalHits"
          WHEN "ApiThrottleBucket"."expiresAt" <= clock_timestamp() OR "ApiThrottleBucket"."blockedUntil" IS NOT NULL THEN 1
          ELSE "ApiThrottleBucket"."totalHits" + 1
        END,
        "expiresAt" = CASE
          WHEN "ApiThrottleBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + (${ttlMs} * interval '1 millisecond')
          ELSE "ApiThrottleBucket"."expiresAt"
        END,
        "blockedUntil" = CASE
          WHEN "ApiThrottleBucket"."blockedUntil" > clock_timestamp() THEN "ApiThrottleBucket"."blockedUntil"
          WHEN "ApiThrottleBucket"."blockedUntil" IS NOT NULL OR "ApiThrottleBucket"."expiresAt" <= clock_timestamp() THEN NULL
          WHEN ${blockMs} > 0 AND "ApiThrottleBucket"."totalHits" >= ${limit} THEN clock_timestamp() + (${blockMs} * interval '1 millisecond')
          ELSE NULL
        END,
        "updatedAt" = clock_timestamp()
      RETURNING "totalHits", "expiresAt", "blockedUntil"
    `;

    const row = rows[0];
    if (!row) throw new Error('Database rate-limit storage returned no row');
    const now = Date.now();
    const timeToExpire = Math.max(0, Math.ceil((row.expiresAt.getTime() - now) / 1000));
    const timeToBlockExpire = row.blockedUntil ? Math.max(0, Math.ceil((row.blockedUntil.getTime() - now) / 1000)) : 0;
    const isBlocked = blockMs > 0 ? timeToBlockExpire > 0 : row.totalHits > limit;

    if (++this.callsSinceCleanup >= 1000) {
      this.callsSinceCleanup = 0;
      const expiredBefore = new Date(now - 60 * 60_000);
      void this.db.apiThrottleBucket.deleteMany({
        where: { expiresAt: { lt: expiredBefore }, OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date(now) } }] },
      }).catch(() => undefined);
    }

    return { totalHits: row.totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}
