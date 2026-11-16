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
    expect(tx.order.updateMany).toHaveBeenCalledTimes(2);
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
});
