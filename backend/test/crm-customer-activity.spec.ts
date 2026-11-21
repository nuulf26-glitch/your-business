import { CustomerController } from '../src/routes';

describe('customer changes in CRM timelines', () => {
  const req = { user: { id: 'owner_a' }, get: () => 'biz_a', params: { id: 'customer_1' } } as any;
  const customer: any = {
    id: 'customer_1',
    businessId: 'biz_a',
    data: { name: 'Ada', email: 'ada@example.test', status: 'Active', notes: '' },
    updatedAt: new Date('2026-11-20T12:00:00.000Z'),
  };
  const setup = () => {
    const db: any = {
      business: { findFirst: jest.fn().mockImplementation(async ({ where }: any) => where.ownerId === 'owner_a' && (!where.id || where.id === 'biz_a') ? { id: 'biz_a' } : null) },
      customer: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => where.businessId === 'biz_a' ? customer : null),
        updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
          if (where.businessId !== 'biz_a') return { count: 0 };
          customer.data = data.data;
          customer.updatedAt = new Date(customer.updatedAt.getTime() + 1000);
          return { count: 1 };
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'customer_new', ...data })),
      },
      businessRecord: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    return { db, controller: new CustomerController(db) };
  };

  beforeEach(() => {
    customer.data = { name: 'Ada', email: 'ada@example.test', status: 'Active', notes: '' };
    customer.updatedAt = new Date('2026-11-20T12:00:00.000Z');
  });

  it('records customer creation and merchant-scoped status changes, without duplicate no-op events', async () => {
    const { db, controller } = setup();
    await controller.create(req, { data: { name: 'New customer', email: 'new@example.test' } } as any);
    expect(db.businessRecord.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ businessId: 'biz_a', type: 'crmActivity', data: expect.objectContaining({ customerId: 'customer_new', kind: 'customer_created' }) })],
      skipDuplicates: true,
    }));

    await controller.updateStatus(req, { status: 'VIP' } as any);
    await controller.updateStatus(req, { status: 'VIP' } as any);
    expect(db.businessRecord.createMany).toHaveBeenCalledTimes(2);
    expect(db.businessRecord.createMany.mock.calls[1][0].data[0].data).toMatchObject({ customerId: 'customer_1', kind: 'customer_status_changed' });

    const foreignRequest = { ...req, get: () => 'biz_other' };
    await expect(controller.updateStatus(foreignRequest, { status: 'Blocked' } as any)).rejects.toThrow('Business not found');
  });

  it('records customer note updates once and avoids timeline noise for identical retries', async () => {
    const { db, controller } = setup();
    await controller.updateNotes(req, { data: { note: 'Prefers email follow-up.' } } as any);
    await controller.updateNotes(req, { data: { note: 'Prefers email follow-up.' } } as any);
    expect(db.businessRecord.createMany).toHaveBeenCalledTimes(1);
    expect(db.businessRecord.createMany.mock.calls[0][0].data[0].data).toMatchObject({ customerId: 'customer_1', kind: 'customer_notes_updated' });
  });
});
