import { OrderController } from '../src/routes';

describe('OrderController collected revenue', () => {
  function fixture() {
    const row: any = {
      id: 'order_1', businessId: 'biz_1', status: 'new', amountCents: 3500, currency: 'USD',
      data: { email: 'buyer@example.com', total: 35, paymentStatus: 'Cash on delivery' },
    };
    const customer: any = { id: 'customer_1', data: { email: 'buyer@example.com', orders: 1, totalSpent: 0 } };
    const tx: any = {
      order: {
        findFirst: jest.fn(async () => row),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (row.status !== where.status) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        findMany: jest.fn(async () => [row]),
        findUnique: jest.fn(async () => row),
      },
      customer: {
        findFirst: jest.fn(async () => customer),
        update: jest.fn(async ({ data }: any) => { customer.data = data.data; return customer; }),
      },
    };
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'biz_1' }) },
      order: {},
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    return { controller: new OrderController(db), row, customer, tx };
  }

  const request: any = { user: { id: 'merchant_1' }, params: { id: 'order_1' } };

  it('counts an unpaid COD order only after the merchant marks it paid, once across retries', async () => {
    const { controller, row, customer, tx } = fixture();

    await controller.updateStatus(request, { status: 'paid' } as any);
    expect(customer.data).toMatchObject({ totalSpent: 35, paidOrders: 1, orders: 1 });
    const paidAt = row.data.paidAt;

    await controller.updateStatus(request, { status: 'paid' } as any);
    expect(customer.data).toMatchObject({ totalSpent: 35, paidOrders: 1, orders: 1 });
    expect(row.data.paidAt).toBe(paidAt);
    expect(row.data.paymentHistory).toHaveLength(1);
    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
  });

  it('retains a single refund record and removes refunded funds from collected spend', async () => {
    const { controller, row, customer } = fixture();

    await controller.updateStatus(request, { status: 'paid' } as any);
    await controller.updateStatus(request, { status: 'refunded' } as any);
    await controller.updateStatus(request, { status: 'refunded' } as any);

    expect(row.data.paymentStatus).toBe('Refunded');
    expect(row.data.refundHistory).toHaveLength(1);
    expect(row.data.refundHistory[0]).toMatchObject({ amountCents: 3500, status: 'recorded' });
    expect(customer.data.totalSpent).toBe(0);
    expect(customer.data.paidOrders).toBe(0);
  });
  it('reports gross collections, refunds, and net revenue separately', async () => {
    const collected = (id: string, amountCents: number, paymentStatus: string, refund = false) => ({
      id, businessId: 'biz_1', status: 'new', amountCents, currency: 'USD',
      createdAt: new Date('2026-11-19T10:00:00.000Z'),
      data: {
        total: amountCents / 100,
        paymentStatus,
        collectedAmountCents: amountCents,
        paymentHistory: [
          { type: 'collected', amountCents, recordedAt: '2026-11-19T10:00:00.000Z' },
          ...(refund ? [{ type: 'refund', amountCents, recordedAt: '2026-11-19T11:00:00.000Z' }] : []),
        ],
        refundHistory: refund ? [{ amountCents, recordedAt: '2026-11-19T11:00:00.000Z', status: 'recorded' }] : [],
        items: [],
      },
    });
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'biz_1' }) },
      order: { findMany: jest.fn().mockResolvedValue([
        collected('paid_37', 3700, 'Paid'),
        collected('refunded_3250', 3250, 'Refunded', true),
      ]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      businessRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const controller = new OrderController(db);

    const analytics = await controller.commerceAnalytics({ user: { id: 'merchant_1' }, get: () => '' } as any);

    expect(analytics).toMatchObject({
      grossCollected: 69.5,
      refunds: 32.5,
      netRevenue: 37,
      revenue: 37,
      averageOrderValue: 34.75,
    });
  });

});
