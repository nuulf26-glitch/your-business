import { NotFoundException } from '@nestjs/common';
import { PublicSupportController, SupportInboxController } from '../src/support-inbox';
import { appendSupportNote, parsePublicSupportSubmission, supportRecordId, supportRequestHash, updateSupportConversation } from '../src/support-inbox-policy';

const requestId = 'a'.repeat(48);
const submission = { requestId, name: 'Test Customer', email: 'CUSTOMER@example.test', subject: 'Order question', message: 'Please help me with my order.', needsHuman: true };

describe('support inbox policy', () => {
  it('validates and minimizes public support fields', () => {
    expect(parsePublicSupportSubmission({ ...submission, extra: 'discarded' })).toEqual({ ...submission, email: 'customer@example.test' });
    expect(() => parsePublicSupportSubmission({ ...submission, email: 'not-an-email' })).toThrow('Enter a valid email address.');
    expect(() => parsePublicSupportSubmission({ ...submission, message: 'x' })).toThrow('Add a little more detail');
    expect(() => parsePublicSupportSubmission({ ...submission, requestId: 'short' })).toThrow('valid request key');
  });

  it('scopes idempotent request identifiers and payload hashes by business and content', () => {
    const parsed = parsePublicSupportSubmission(submission);
    expect(supportRecordId('merchant-a', requestId)).not.toBe(supportRecordId('merchant-b', requestId));
    expect(supportRequestHash(parsed)).toBe(supportRequestHash({ ...parsed, requestId: 'b'.repeat(48) }));
    expect(supportRequestHash(parsed)).not.toBe(supportRequestHash({ ...parsed, message: 'A different support request body.' }));
  });

  it('keeps assignments within the authenticated owner and records internal notes', () => {
    const initial = { status: 'open', assignedToUserId: null, requiresHuman: true, messages: [] };
    expect(() => updateSupportConversation(initial, { assignedToUserId: 'another-owner' }, 'owner-a')).toThrow('only be assigned to you');
    const updated = updateSupportConversation(initial, { assignToMe: true, status: 'in_progress' }, 'owner-a');
    expect(updated).toMatchObject({ assignedToUserId: 'owner-a', status: 'in_progress' });
    expect(updateSupportConversation(updated, { status: 'closed', requiresHuman: false }, 'owner-a')).toMatchObject({ status: 'closed', requiresHuman: false, closedAt: expect.any(String), handoffReason: null });
    const withNote = appendSupportNote(updated, 'Internal follow-up', 'owner-a');
    expect(withNote.messages.at(-1)).toMatchObject({ kind: 'internal_note', body: 'Internal follow-up', authorId: 'owner-a' });
  });
});

describe('merchant-scoped support inbox API', () => {
  it('returns only the authenticated business conversations', async () => {
    const record = { id: 'ticket-a', businessId: 'business-a', type: 'supportConversation', status: 'open', data: { subject: 'Question', name: 'Customer', email: 'customer@example.test', channel: 'website', messages: [], requiresHuman: true, requestHash: 'secret' }, createdAt: new Date(), updatedAt: new Date() };
    const db: any = {
      business: { findFirst: jest.fn(async ({ where }: any) => where.ownerId === 'owner-a' && where.id === 'business-a' ? { id: 'business-a', ownerId: 'owner-a' } : null) },
      businessRecord: { findMany: jest.fn(async ({ where }: any) => where.businessId === 'business-a' ? [record] : []), findFirst: jest.fn(async ({ where }: any) => where.businessId === 'business-a' && where.id === record.id ? record : null) },
    };
    const controller = new SupportInboxController(db);
    const req: any = { user: { id: 'owner-a' }, get: () => 'business-a' };
    expect(await controller.list(req, {})).toEqual([expect.objectContaining({ id: 'ticket-a', subject: 'Question', requiresHuman: true })]);
    expect(db.businessRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'business-a', type: 'supportConversation' } }));
    expect(await controller.get(req, 'ticket-a')).not.toHaveProperty('requestHash');
    const foreignReq: any = { user: { id: 'owner-b' }, get: () => 'business-a' };
    await expect(controller.get(foreignReq, 'ticket-a')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a public request once, stores only generic notification content, and returns the same order on a retry', async () => {
    const rows = new Map<string, any>();
    const notifications: any[] = [];
    const business = { id: 'business-a', slug: 'store-a', website: { published: {} } };
    const db: any = {
      business: { findUnique: jest.fn(async ({ where }: any) => where.slug === business.slug ? business : null) },
      businessRecord: {
        findUnique: jest.fn(async ({ where }: any) => rows.get(where.id) || null),
        create: jest.fn(async ({ data }: any) => { if (data.type === 'notifications') { notifications.push(data); return data; } rows.set(data.id, { ...data, createdAt: new Date(), updatedAt: new Date() }); return rows.get(data.id); }),
      },
      $transaction: jest.fn(async (callback: any) => callback({ businessRecord: { create: db.businessRecord.create } })),
    };
    const controller = new PublicSupportController(db);
    const payload = { data: { ...submission, storeUrl: 'store-a' } };
    expect(await controller.create(payload)).toEqual({ id: supportRecordId('business-a', requestId), duplicate: false });
    expect(await controller.create(payload)).toEqual({ id: supportRecordId('business-a', requestId), duplicate: true });
    expect(rows.size).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(JSON.stringify(notifications[0].data)).not.toContain('customer@example.test');
    expect(JSON.stringify(notifications[0].data)).not.toContain('Test Customer');
    expect(rows.get(supportRecordId('business-a', requestId)).data).not.toHaveProperty('requestId');
  });
});
