import { PublicOrderController } from '../src/routes';
import { tokenHash } from '../src/session';

const checkoutKey = 'a'.repeat(43);

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
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const controller = new PublicOrderController(db);

    const result = await controller.create(checkoutKey, { data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com',
      items: [{ productId: 'prod_1', quantity: 1, price: 0.01 }], total: 0.01,
      paymentStatus: 'Paid', paymentHistory: [{ type: 'collected', amountCents: 1 }],
    } });

    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amountCents: 3500, currency: 'USD' }),
    }));
    const stored = tx.order.create.mock.calls[0][0].data.data;
    expect(stored.subtotal).toBe(10);
    expect(stored.shipping).toBe(25);
    expect(stored.total).toBe(35);
    expect(stored.customerActionTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tx.order.create.mock.calls[0][0].data.checkoutKey).toBe(tokenHash(checkoutKey));
    expect(tx.order.create.mock.calls[0][0].data.checkoutKey).not.toBe(checkoutKey);
    expect(stored.paymentStatus).toBe('Pending');
    expect(stored.paymentMethod).toBe('cash');
    expect(stored.paymentHistory).toEqual([]);
    expect(tx.customer.create.mock.calls[0][0].data.data.totalSpent).toBe(0);
    expect(result).toHaveProperty('cashOnDeliveryToken');
    expect(result.cashOnDeliveryToken).toBe(checkoutKey);
    expect(result).not.toHaveProperty('customerActionTokenHash');
    expect(result).not.toHaveProperty('checkoutFingerprint');
  });

  it('requires the per-order customer token and ignores client-supplied order fields', async () => {
    const token = 'authorized-order-action-token-1234567890';
    const row = {
      id: 'order_1', status: 'new',
      data: { customerActionTokenHash: tokenHash(token), total: 35, status: 'New', paymentStatus: 'Pending' },
    };
    const db: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const controller = new PublicOrderController(db);

    await expect(controller.setCashOnDelivery(
      { params: { id: 'order_1' } } as any,
      { token, data: { status: 'paid', total: 0.01, paymentStatus: 'Paid' } } as any,
    )).resolves.toEqual({ ok: true });

    const update = db.order.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'order_1', status: 'new' });
    expect(update.data.data).toMatchObject({ total: 35, status: 'New', paymentStatus: 'Unpaid', paymentMethod: 'cash' });
    expect(update.data.data.customerActionTokenHash).toBe(tokenHash(token));
  });

  it('rejects an invalid customer token without changing an order', async () => {
    const db: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: 'order_1', status: 'new', data: { customerActionTokenHash: tokenHash('correct-token-12345678901234567890') } }),
        updateMany: jest.fn(),
      },
    };
    const controller = new PublicOrderController(db);

    await expect(controller.setCashOnDelivery(
      { params: { id: 'order_1' } } as any,
      { token: 'wrong-token-123456789012345678901234' } as any,
    )).rejects.toThrow('Order not found');
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('preserves an explicit zero sale price instead of charging the regular price', async () => {
    const createdOrder = { id: 'order_free', status: 'new', createdAt: new Date(), data: {} };
    const tx = {
      order: { create: jest.fn().mockResolvedValue(createdOrder) },
      customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz_1', slug: 'sample-shop', website: { published: {} } }) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod_1', name: 'Item', data: { sellingPrice: 10, salePrice: 0 } }]) },
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await new PublicOrderController(db).create(checkoutKey, { data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com', items: [{ productId: 'prod_1', quantity: 1 }],
    } });

    const order = tx.order.create.mock.calls[0][0].data;
    expect(order.data.items[0].price).toBe(0);
    expect(order.amountCents).toBe(2500);
  });

  it('uses the regular price when the sale price field is blank', async () => {
    const tx = {
      order: { create: jest.fn().mockResolvedValue({ id: 'order_blank_sale', status: 'new', createdAt: new Date(), data: {} }) },
      customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'biz_1', slug: 'sample-shop', website: { published: {} } }) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod_1', name: 'Item', data: { sellingPrice: 10, salePrice: '' } }]) },
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await new PublicOrderController(db).create(checkoutKey, { data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com', items: [{ productId: 'prod_1', quantity: 1 }],
    } });

    const order = tx.order.create.mock.calls[0][0].data;
    expect(order.data.items[0].price).toBe(10);
    expect(order.amountCents).toBe(3500);
  });

  it('returns the same order and COD action token for a repeated checkout key', async () => {
    const business = { id: 'biz_1', slug: 'sample-shop', website: { published: {} } };
    let savedOrder: any = null;
    const tx = {
      order: { create: jest.fn(async ({ data }: any) => { savedOrder = { ...data, id: 'order_1', createdAt: new Date() }; return savedOrder; }) },
      customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue(business) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod_1', name: 'Item', data: { sellingPrice: 10 } }]) },
      order: { findUnique: jest.fn(async () => savedOrder) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const controller = new PublicOrderController(db);
    const request = { data: { storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com', items: [{ productId: 'prod_1', quantity: 1 }] } };

    const first = await controller.create(checkoutKey, request);
    const retry = await controller.create(checkoutKey, request);

    expect(retry).toEqual(first);
    expect(first.cashOnDeliveryToken).toBe(checkoutKey);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.customer.create).toHaveBeenCalledTimes(1);
  });

  it('rejects checkout key reuse when the submitted order changes', async () => {
    const business = { id: 'biz_1', slug: 'sample-shop', website: { published: {} } };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue(business) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod_1', name: 'Item', data: { sellingPrice: 10 } }]) },
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order_1', businessId: 'biz_1', status: 'new', createdAt: new Date(), data: { checkoutFingerprint: 'different' } }) },
    };

    await expect(new PublicOrderController(db).create(checkoutKey, { data: { storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com', items: [{ productId: 'prod_1', quantity: 1 }] } })).rejects.toThrow('already used for a different order');
  });
});
