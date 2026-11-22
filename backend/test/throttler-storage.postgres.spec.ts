import { createHash, randomUUID } from 'node:crypto';
import { DbService } from '../src/database';
import { DatabaseThrottlerStorage } from '../src/throttler-storage';

const describeWithDatabase = process.env.CYB_TEST_THROTTLE_DB === '1' ? describe : describe.skip;

describeWithDatabase('PostgreSQL rate limiting across API replicas', () => {
  const db = new DbService();
  const key = `parallel-test:${randomUUID()}`;
  const throttlerName = 'replica-integration-test';
  const id = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');

  beforeAll(async () => { await db.$connect(); });
  afterAll(async () => {
    await db.apiThrottleBucket.deleteMany({ where: { id } });
    await db.$disconnect();
  });

  it('coordinates concurrent increments from independent storage instances through one PostgreSQL window', async () => {
    const replicaA = new DatabaseThrottlerStorage(db);
    const replicaB = new DatabaseThrottlerStorage(db);
    const requestCount = 40;
    const limit = 20;
    const records = await Promise.all(Array.from({ length: requestCount }, (_, index) =>
      (index % 2 ? replicaA : replicaB).increment(key, 60_000, limit, 0, throttlerName),
    ));

    const persisted = await db.apiThrottleBucket.findUnique({ where: { id } });
    expect(persisted?.totalHits).toBe(requestCount);
    expect(records.filter(record => record.isBlocked)).toHaveLength(requestCount - limit);
  });
});
