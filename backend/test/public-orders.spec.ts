import { PublicOrderController } from '../src/routes';

describe('PublicOrderController', () => {
  it('uses database product prices instead of the amount sent by the browser', async () => {
    const business = { id: 'biz_1', slug: 'sample-shop', website: { published: { brandName: 'Sample' } } };
    const createdOrder = { id: 'order_1', status: 'new', createdAt: new Date(), data: {} };
    const tx = {
      order: { create: jest.fn().mockResolvedValue(createdOrder) },
      customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue(business) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod_1', name: 'Item', data: { sellingPrice: 10 } }]) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const controller = new PublicOrderController(db);

    await controller.create({ data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com',
      items: [{ id: 'prod_1', quantity: 1, price: 0.01 }], total: 0.01,
    } });

    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amountCents: 3500, currency: 'USD' }),
    }));
    const stored = tx.order.create.mock.calls[0][0].data.data;
    expect(stored.subtotal).toBe(10);
    expect(stored.shipping).toBe(25);
    expect(stored.total).toBe(35);
  });
});
