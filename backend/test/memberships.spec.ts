import { createHash } from 'node:crypto';
import { MembershipsController, PublicMembershipsController } from '../src/memberships';

function withTransaction(db: any) {
  db.$transaction = jest.fn(async (callback: (tx: any) => Promise<any>) => callback({
    ...db,
    $queryRaw: jest.fn().mockResolvedValue([]),
  }));
  return db;
}

const request = (businessId = 'biz_a') => ({
  user: { id: 'owner_a' },
  get: (name: string) => name === 'x-cyb-business-id' ? businessId : undefined,
} as any);
const ownedBusiness = {
  findFirst: jest.fn(async ({ where }: any) => where.ownerId === 'owner_a' && ['biz_a', 'biz_b'].includes(where.id)
    ? { id: where.id, name: 'Atelier' }
    : null),
};

describe('MembershipsController tenant isolation and entitlements', () => {
  it('keeps tiers scoped to the selected owned business', async () => {
    const db: any = {
      business: ownedBusiness,
      businessRecord: {
        findMany: jest.fn(async ({ where }: any) => where.businessId === 'biz_a'
          ? [{ id: 'tier_a', businessId: 'biz_a', type: 'membershipTier', status: 'active', data: { name: 'Studio' } }]
          : []),
      },
    };
    const controller = new MembershipsController(db);
    expect(await controller.listTiers(request())).toMatchObject([{ id: 'tier_a', name: 'Studio' }]);
    await expect(controller.listTiers(request('biz_missing'))).rejects.toThrow('Business not found');
    expect(db.businessRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz_a', type: 'membershipTier' } }));
  });

  it('requires an active tenant tier and validates the protected-content schema', async () => {
    const db: any = { business: ownedBusiness, businessRecord: { findMany: jest.fn(), create: jest.fn() } };
    const controller = new MembershipsController(db);
    await expect(controller.createTier(request(), { data: { name: '   ', protectedContent: [] } })).rejects.toThrow('Tier name is required');
    await expect(controller.createTier(request(), { data: { name: 'Studio', protectedContent: ['one', '', 'three'] } })).rejects.toThrow('cannot be empty');
    await expect(controller.createTier(request('biz_missing'), { data: { name: 'Studio' } })).rejects.toThrow('Business not found');
    expect(db.businessRecord.create).not.toHaveBeenCalled();
  });

  it('stores only a token hash and creates manual access for an owned business tier', async () => {
    const stored: any[] = [];
    const db: any = withTransaction({
      business: ownedBusiness,
      customer: { findFirst: jest.fn(async () => ({ id: 'customer_a' })) },
      businessRecord: {
        findFirst: jest.fn(async ({ where }: any) => where.type === 'membershipTier' && where.businessId === 'biz_a'
          ? { id: 'tier_a', businessId: 'biz_a', type: 'membershipTier', status: 'active', data: { name: 'Studio' } }
          : null),
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }: any) => { const row = { id: 'entitlement_a', ...data }; stored.push(row); return row; }),
      },
    });
    const result = await new MembershipsController(db).grantEntitlement(request(), {
      data: { name: 'Ari Member', email: 'ARI@example.test', tierId: 'tier_a' },
    });
    expect(result).toMatchObject({ id: 'entitlement_a', email: 'ari@example.test', tierId: 'tier_a', tierName: 'Studio', source: 'manual' });
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{40,64}$/);
    expect(stored[0].businessId).toBe('biz_a');
    expect(stored[0].data.tokenHash).toBe(createHash('sha256').update(result.accessToken).digest('hex'));
    expect(JSON.stringify(stored[0])).not.toContain(result.accessToken);
    expect(stored[0].data.customerId).toBe('customer_a');
  });

  it('rejects duplicate active grants and does not create a second key', async () => {
    const db: any = withTransaction({
      business: ownedBusiness,
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      businessRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tier_a', businessId: 'biz_a', status: 'active', data: { name: 'Studio' } }),
        findMany: jest.fn().mockResolvedValue([{ status: 'active', data: { email: 'ari@example.test', tierId: 'tier_a', endsAt: null } }]),
        create: jest.fn(),
      },
    });
    await expect(new MembershipsController(db).grantEntitlement(request(), { data: { name: 'Ari', email: 'ari@example.test', tierId: 'tier_a' } })).rejects.toThrow('already has active access');
    expect(db.businessRecord.create).not.toHaveBeenCalled();
  });

  it('revokes only an entitlement owned by the selected business and is idempotent', async () => {
    const row = { id: 'entitlement_a', businessId: 'biz_a', type: 'membershipEntitlement', status: 'active', data: { email: 'ari@example.test' } };
    const db: any = {
      business: ownedBusiness,
      businessRecord: {
        findFirst: jest.fn(async ({ where }: any) => where.businessId === 'biz_a' && where.id === row.id ? row : null),
        updateMany: jest.fn(async ({ where, data }: any) => { if (where.businessId !== row.businessId) return { count: 0 }; row.status = data.status; row.data = data.data; return { count: 1 }; }),
      },
    };
    const controller = new MembershipsController(db);
    await expect(controller.revokeEntitlement(request('biz_b'), row.id)).rejects.toThrow('Membership access not found');
    expect((await controller.revokeEntitlement(request(), row.id)).status).toBe('revoked');
    const calls = db.businessRecord.updateMany.mock.calls.length;
    await expect(controller.revokeEntitlement(request(), row.id)).resolves.toMatchObject({ status: 'revoked' });
    expect(db.businessRecord.updateMany).toHaveBeenCalledTimes(calls);
  });
});

describe('PublicMembershipsController protected content access', () => {
  const token = 'a'.repeat(43);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const activeEntitlement = (overrides: any = {}) => ({
    id: 'entitlement_a', businessId: 'biz_a', type: 'membershipEntitlement', status: 'active',
    data: { name: 'Private Member', email: 'private@example.test', tokenHash, tierId: 'tier_a', startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: null, ...overrides },
  });

  it('reveals only tier content for a valid active token', async () => {
    const db: any = {
      businessRecord: {
        findFirst: jest.fn(async ({ where }: any) => where.type === 'membershipEntitlement'
          ? activeEntitlement()
          : { id: 'tier_a', businessId: 'biz_a', type: 'membershipTier', status: 'active', data: { name: 'Studio', protectedContent: ['Members only class'] } }),
      },
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'Atelier' }) },
    };
    const result = await new PublicMembershipsController(db).access({ token });
    expect(result).toEqual({ businessName: 'Atelier', tierName: 'Studio', description: '', content: ['Members only class'], expiresAt: null });
    expect(JSON.stringify(result)).not.toContain('private@example.test');
    expect(JSON.stringify(result)).not.toContain(tokenHash);
    expect(db.businessRecord.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { type: 'membershipEntitlement', data: { path: ['tokenHash'], equals: tokenHash } } }));
  });

  it.each([
    ['malformed token', 'short', activeEntitlement(), undefined],
    ['revoked token', token, activeEntitlement(), 'revoked'],
    ['future entitlement', token, activeEntitlement({ startsAt: new Date(Date.now() + 60_000).toISOString() }), undefined],
    ['expired entitlement', token, activeEntitlement({ endsAt: new Date(Date.now() - 60_000).toISOString() }), undefined],
  ])('rejects %s without disclosing why access failed', async (_label, supplied, entitlement, status) => {
    const db: any = {
      businessRecord: { findFirst: jest.fn().mockResolvedValue({ ...entitlement, ...(status ? { status } : {}) }) },
      business: { findUnique: jest.fn() },
    };
    await expect(new PublicMembershipsController(db).access({ token: supplied })).rejects.toThrow('Membership access is unavailable');
    expect(db.business.findUnique).not.toHaveBeenCalled();
  });
});
