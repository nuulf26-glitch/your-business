import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketingController } from '../src/marketing';

function marketingDb() {
  const businesses: any[] = [
    { id: 'biz_a', ownerId: 'owner_a', slug: 'atelier-a', settings: {} },
    { id: 'biz_b', ownerId: 'owner_b', slug: 'atelier-b', settings: {} },
  ];
  const rows: any[] = [];
  let nextId = 0;
  const matches = (row: any, where: any) => Object.entries(where || {}).every(([key, value]: any) => {
    if (key === 'status' && value && typeof value === 'object' && 'not' in value) return row.status !== value.not;
    return row[key] === value;
  });
  const db: any = {
    business: {
      findFirst: jest.fn(async ({ where }: any) => businesses.find(row => row.ownerId === where.ownerId && (!where.id || row.id === where.id)) || null),
      findUnique: jest.fn(async ({ where }: any) => businesses.find(row => row.slug === where.slug) || null),
      update: jest.fn(async ({ where, data }: any) => {
        const row = businesses.find(item => item.id === where.id);
        if (!row) throw new Error('Business not found');
        Object.assign(row, data); return row;
      }),
    },
    businessRecord: {
      findFirst: jest.fn(async ({ where }: any) => rows.find(row => matches(row, where)) || null),
      findMany: jest.fn(async ({ where, take, orderBy }: any) => {
        let found = rows.filter(row => matches(row, where));
        if (orderBy?.createdAt === 'desc') found = [...found].reverse();
        return found.slice(0, take || found.length);
      }),
      create: jest.fn(async ({ data }: any) => {
        const now = new Date();
        const row = { id: data.id || `record_${++nextId}`, status: 'new', read: false, createdAt: now, updatedAt: now, ...data };
        rows.push(row); return row;
      }),
      createMany: jest.fn(async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const input of data) {
          if (skipDuplicates && rows.some(row => row.id === input.id)) continue;
          rows.push({ id: input.id || `record_${++nextId}`, status: 'new', createdAt: new Date(), updatedAt: new Date(), ...input }); count += 1;
        }
        return { count };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const found = rows.filter(row => matches(row, where));
        for (const row of found) { Object.assign(row, data); row.updatedAt = new Date(); }
        return { count: found.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], where)) rows.splice(i, 1);
        return { count: before - rows.length };
      }),
    },
  };
  return { db, rows, businesses };
}

const request = (businessId = 'biz_a', ownerId = 'owner_a') => ({ user: { id: ownerId }, get: () => businessId } as any);
const consented = { data: { name: 'Ari', email: 'ari@example.test', consented: true, consentSource: 'Website newsletter checkbox' } };

describe('Marketing consent, unsubscribe, suppression and tenant boundaries', () => {
  const previousSecret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  beforeAll(() => { process.env.MARKETING_UNSUBSCRIBE_SECRET = 'test-only-marketing-secret-with-sufficient-length'; });
  afterAll(() => { if (previousSecret === undefined) delete process.env.MARKETING_UNSUBSCRIBE_SECRET; else process.env.MARKETING_UNSUBSCRIBE_SECRET = previousSecret; });

  it('requires affirmative consent and an evidence source before adding a marketing contact', async () => {
    const { db } = marketingDb(); const controller = new MarketingController(db);
    await expect(controller.addContact(request(), { data: { ...consented.data, consented: false } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.addContact(request(), { data: { ...consented.data, consentSource: '' } })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.businessRecord.create).not.toHaveBeenCalled();
  });

  it('does not permit one merchant to list or unsubscribe another merchant contact', async () => {
    const { db } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request('biz_b', 'owner_b'), consented);
    await expect(controller.contacts(request())).resolves.toEqual([]);
    await expect(controller.unsubscribeAsOwner(request(), contact.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.businessRecord.updateMany).not.toHaveBeenCalled();
  });

  it('validates the signed public link and makes opt-out idempotent', async () => {
    const { db } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request(), consented);
    await expect(controller.unsubscribePublic({ data: { businessSlug: 'atelier-a', contactId: contact.id, token: 'bad-token' } })).rejects.toBeInstanceOf(NotFoundException);
    const first = await controller.unsubscribePublic({ data: { businessSlug: contact.businessSlug, contactId: contact.id, token: contact.unsubscribeToken } });
    expect(first).toMatchObject({ id: contact.id, consentStatus: 'unsubscribed', unchanged: false });
    const second = await controller.unsubscribePublic({ data: { businessSlug: contact.businessSlug, contactId: contact.id, token: contact.unsubscribeToken } });
    expect(second).toMatchObject({ consentStatus: 'unsubscribed', unchanged: true });
    expect(db.businessRecord.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not let a campaign re-enable or queue an unsubscribed contact', async () => {
    const { db, rows } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request(), consented);
    const campaign = await controller.createCampaign(request(), { data: { name: 'Spring', subject: 'A note', content: 'Hello {{unsubscribe_url}}' } });
    await controller.unsubscribeAsOwner(request(), contact.id);
    await expect(controller.addContact(request(), consented)).rejects.toBeInstanceOf(ConflictException);
    await expect(controller.queueCampaign(request(), campaign.id)).rejects.toBeInstanceOf(BadRequestException);
    const contactRow = rows.find(row => row.id === contact.id);
    expect(contactRow.data.consentStatus).toBe('unsubscribed');
  });

  it('requires an unsubscribe placeholder before a campaign can be queued', async () => {
    const { db } = marketingDb(); const controller = new MarketingController(db);
    await controller.addContact(request(), consented);
    const campaign = await controller.createCampaign(request(), { data: { name: 'Spring', subject: 'A note', content: 'Hello' } });
    await expect(controller.queueCampaign(request(), campaign.id)).rejects.toMatchObject({ message: 'Add the {{unsubscribe_url}} placeholder before queueing' });
  });

  it('queues only a consent-checked count and stores no contact recipients', async () => {
    const { db, rows } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request(), consented);
    const campaign = await controller.createCampaign(request(), { data: { name: 'Spring', subject: 'A note', content: 'Hello {{unsubscribe_url}}' } });
    const queued = await controller.queueCampaign(request(), campaign.id);
    expect(queued).toMatchObject({ status: 'queued', eligibleCount: 1 });
    const stored = rows.find(row => row.id === campaign.id);
    expect(stored.data).not.toHaveProperty('eligibleContactIds');
    expect(stored.data.suppressionPolicy).toMatch(/recheck consent/);
    await controller.unsubscribeAsOwner(request(), contact.id);
    expect(rows.find(row => row.id === contact.id).data.consentStatus).toBe('unsubscribed');
  });

  it('records explicit re-consent and rejects reactivation without evidence', async () => {
    const { db } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request(), consented);
    await controller.unsubscribeAsOwner(request(), contact.id);
    await expect(controller.reconsent(request(), contact.id, { data: { consented: true, evidence: 'short' } })).rejects.toBeInstanceOf(BadRequestException);
    const updated = await controller.reconsent(request(), contact.id, { data: { consented: true, evidence: 'Submitted new opt-in form on the site' } });
    expect(updated.consentStatus).toBe('subscribed');
    expect(updated.unsubscribedAt).toBeNull();
    expect(updated.consentSource).toContain('new opt-in');
  });
});

describe('Marketing contact retention', () => {
  it('deletes an opted-out contact while retaining only a temporary address hash', async () => {
    const { db, rows } = marketingDb(); const controller = new MarketingController(db);
    const contact = await controller.addContact(request(), consented);
    await controller.unsubscribeAsOwner(request(), contact.id);
    await expect(controller.deleteContact(request(), contact.id)).resolves.toEqual({ deleted: true });
    expect(rows.some(row => row.id === contact.id)).toBe(false);
    const suppression = rows.find(row => row.type === 'marketingSuppression');
    expect(suppression.data).toMatchObject({ emailHash: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(String) });
    expect(JSON.stringify(suppression.data)).not.toContain(consented.data.email);
    await expect(controller.addContact(request(), consented)).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes expired unsubscribed PII, keeps a timed suppression hash, then expires it', async () => {
    const { db, rows } = marketingDb(); const controller = new MarketingController(db);
    const old = new Date(Date.now() - 400 * 86_400_000);
    const contact = { id: 'old_contact', businessId: 'biz_a', type: 'marketingContact', status: 'unsubscribed', data: { name: 'Old Name', email: 'old@example.test', consentStatus: 'unsubscribed', unsubscribedAt: old.toISOString() }, createdAt: old, updatedAt: old };
    rows.push(contact);
    await controller.contacts(request());
    expect(rows.some(row => row.id === contact.id)).toBe(false);
    const suppression = rows.find(row => row.type === 'marketingSuppression');
    expect(suppression.data).toMatchObject({ expiresAt: expect.any(String), emailHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(JSON.stringify(suppression.data)).not.toContain('old@example.test');
    suppression.data.expiresAt = new Date(Date.now() - 1).toISOString();
    await controller.contacts(request());
    expect(rows.some(row => row.type === 'marketingSuppression')).toBe(false);
  });
});
