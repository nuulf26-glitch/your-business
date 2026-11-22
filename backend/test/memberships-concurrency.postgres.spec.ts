import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { DbService } from '../src/database';
import { MembershipsController } from '../src/memberships';

const describeWithDatabase = process.env.CYB_TEST_MEMBERSHIPS_DB === '1' ? describe : describe.skip;

describeWithDatabase('Membership entitlement grant concurrency across API clients', () => {
  const dbA = new DbService();
  const dbB = new DbService();
  const suffix = randomUUID();
  const email = `membership-race-${suffix}@example.test`;
  let ownerId: string;
  let businessId: string;
  let tierId: string;

  const request = () => ({
    user: { id: ownerId },
    get: (name: string) => name === 'x-cyb-business-id' ? businessId : undefined,
  } as any);

  beforeAll(async () => {
    await Promise.all([dbA.$connect(), dbB.$connect()]);
    const owner = await dbA.user.create({ data: { email: `membership-owner-${suffix}@example.test` } });
    ownerId = owner.id;
    const business = await dbA.business.create({ data: { ownerId, name: 'Membership Race Test', slug: `membership-race-${suffix}` } });
    businessId = business.id;
    const tier = await dbA.businessRecord.create({
      data: { businessId, type: 'membershipTier', status: 'active', data: { name: 'Test Tier', protectedContent: [] } },
    });
    tierId = tier.id;
  });

  afterAll(async () => {
    if (businessId) await dbA.business.deleteMany({ where: { id: businessId } });
    if (ownerId) await dbA.user.deleteMany({ where: { id: ownerId } });
    await Promise.all([dbA.$disconnect(), dbB.$disconnect()]);
  });

  it('allows only one concurrent grant for a normalized business, tier, and email key', async () => {
    const controllerA = new MembershipsController(dbA);
    const controllerB = new MembershipsController(dbB);
    const outcomes = await Promise.allSettled([
      controllerA.grantEntitlement(request(), { data: { name: 'Test Member', email: email.toUpperCase(), tierId } }),
      controllerB.grantEntitlement(request(), { data: { name: 'Test Member', email, tierId } }),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected') as PromiseRejectedResult[];
    if (fulfilled.length !== 1) {
      const failures = rejected.map(({ reason }) => reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason));
      throw new Error(`Expected one successful grant, got ${fulfilled.length}; rejected outcomes: ${failures.join(' | ') || '(none)'}`);
    }
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(await dbA.businessRecord.count({ where: { businessId, type: 'membershipEntitlement' } })).toBe(1);
  });
});
