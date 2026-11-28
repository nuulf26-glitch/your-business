import { DatabaseThrottlerStorage } from '../src/throttler-storage';

describe('shared database throttling', () => {
  it('blocks at the configured boundary and reports both expirations', async () => {
    const now = Date.now();
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ totalHits: 6, expiresAt: new Date(now + 30_000), blockedUntil: new Date(now + 12_000) }]),
      apiThrottleBucket: { deleteMany: jest.fn() },
    };
    const storage = new DatabaseThrottlerStorage(db);

    await expect(storage.increment('POST:/auth/login:192.0.2.10', 60_000, 5, 60_000, 'default')).resolves.toEqual({
      totalHits: 6,
      timeToExpire: expect.any(Number),
      isBlocked: true,
      timeToBlockExpire: expect.any(Number),
    });
    const query = db.$queryRaw.mock.calls[0][0] as TemplateStringsArray;
    expect(query.join('')).toContain('ON CONFLICT ("id") DO UPDATE');
    expect(db.$queryRaw.mock.calls[0].slice(1)).not.toContain('POST:/auth/login:192.0.2.10');
  });

  it('does not report a blocked response before the threshold', async () => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ totalHits: 5, expiresAt: new Date(Date.now() + 30_000), blockedUntil: null }]),
      apiThrottleBucket: { deleteMany: jest.fn() },
    };
    const storage = new DatabaseThrottlerStorage(db);
    await expect(storage.increment('key', 60_000, 5, 60_000, 'default')).resolves.toEqual({
      totalHits: 5,
      timeToExpire: expect.any(Number),
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('uses a hashed database key rather than storing an IP or route key in clear text', async () => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ totalHits: 1, expiresAt: new Date(Date.now() + 30_000), blockedUntil: null }]),
      apiThrottleBucket: { deleteMany: jest.fn() },
    };
    const storage = new DatabaseThrottlerStorage(db);
    await storage.increment('POST:/auth/login:192.0.2.10', 60_000, 5, 60_000, 'default');
    expect(db.$queryRaw.mock.calls[0]).not.toContain('POST:/auth/login:192.0.2.10');
  });
});
