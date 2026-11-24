import { OrderController, ProductController, PublicProductController } from '../src/routes';

describe('OrderController inventory release', () => {
  function fixture(options: { variants?: any[]; stock?: number; line?: any } = {}) {
    const product: any = {
      id: 'product_1', businessId: 'business_1',
      data: {
        stock: options.stock ?? 2,
        ...(options.variants ? { variants: options.variants } : {}),
      },
    };
    const order: any = {
      id: 'order_1', businessId: 'business_1', status: 'new',
      data: {
        fulfillmentStatus: 'new', paymentStatus: 'Cash on delivery',
        items: [options.line || { id: product.id, variantId: 'blue-medium', quantity: 1 }],
      },
    };
    const tx: any = {
      product: {
        findFirst: jest.fn(async ({ where }: any) => where.businessId === product.businessId && where.id === product.id ? product : null),
        findMany: jest.fn(async ({ where }: any) => where.businessId === product.businessId ? [product] : []),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.businessId !== product.businessId || where.id !== product.id || JSON.stringify(where.data.equals) !== JSON.stringify(product.data)) return { count: 0 };
          product.data = data.data;
          return { count: 1 };
        }),
      },
      order: {
        findFirst: jest.fn(async ({ where }: any) => where.businessId === order.businessId && where.id === order.id ? order : null),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.businessId !== order.businessId || where.id !== order.id || order.status !== where.status || JSON.stringify(order.data) !== JSON.stringify(where.data.equals)) return { count: 0 };
          Object.assign(order, data);
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => order),
      },
    };
    let tail = Promise.resolve();
    const db: any = {
      business: {
        findFirst: jest.fn().mockResolvedValue({ id: 'business_1', ownerId: 'merchant_1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'business_1', slug: 'test-shop', settings: {}, website: { published: {} } }),
      },
      product: { findMany: jest.fn(async ({ where }: any) => where.businessId === product.businessId ? [product] : []) },
      $transaction: jest.fn(async (callback: any) => {
        let release!: () => void;
        const previous = tail;
        tail = new Promise<void>(resolve => { release = resolve; });
        await previous;
        try { return await callback(tx); } finally { release(); }
      }),
    };
    return { controller: new OrderController(db), product, order, tx, db };
  }

  const request: any = { user: { id: 'merchant_1' }, params: { id: 'order_1' } };

  it('restores the selected variant and recomputes parent stock after cancellation', async () => {
    const { controller, product } = fixture({
      stock: 5,
      variants: [
        { id: 'blue-medium', name: 'Blue / Medium', stock: 2 },
        { id: 'red-medium', name: 'Red / Medium', stock: 3 },
      ],
    });
    await controller.updateStatus(request, { status: 'cancelled' } as any);
    expect(product.data).toMatchObject({ stock: 6, variants: [{ id: 'blue-medium', stock: 3 }, { id: 'red-medium', stock: 3 }] });
  });

  it('restores non-variant product stock on cancellation', async () => {
    const { controller, product } = fixture({ stock: 2, line: { id: 'product_1', quantity: 1 } });
    const savedOrder = await controller.updateStatus(request, { status: 'cancelled' } as any) as any;
    expect(product.data.stock).toBe(3);
    expect(savedOrder).toMatchObject({ status: 'cancelled', data: { fulfillmentStatus: 'cancelled' } });
  });

  it('returns the same post-cancellation available quantity to merchant inventory and storefront', async () => {
    const { controller, product, db } = fixture({
      stock: 1,
      line: { id: 'product_1', quantity: 1 },
    });

    await controller.updateStatus(request, { status: 'cancelled' } as any);

    const merchantProducts = await new ProductController(db).list({ user: { id: 'merchant_1' } } as any) as any[];
    const storefrontProducts = await new PublicProductController(db).list({ params: { slug: 'test-shop' } } as any) as any[];
    expect(merchantProducts[0].data.stock).toBe(2);
    expect(storefrontProducts[0].stock).toBe(merchantProducts[0].data.stock);
  });

  it('does not release variant or parent inventory a second time on retries', async () => {
    const { controller, product, order, tx } = fixture({
      stock: 2, variants: [{ id: 'blue-medium', name: 'Blue / Medium', stock: 2 }],
    });
    await controller.updateStatus(request, { status: 'cancelled' } as any);
    const released = structuredClone(product.data);
    await controller.updateStatus(request, { status: 'cancelled' } as any);
    expect(product.data).toEqual(released);
    expect(order.data.inventoryHistory).toHaveLength(1);
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent cancellation retries and releases inventory once', async () => {
    const { controller, product, order, tx } = fixture({
      stock: 2, variants: [{ id: 'blue-medium', name: 'Blue / Medium', stock: 2 }],
    });
    await Promise.all(Array.from({ length: 5 }, () => controller.updateStatus(request, { status: 'cancelled' } as any)));
    expect(product.data).toMatchObject({ stock: 3, variants: [{ id: 'blue-medium', stock: 3 }] });
    expect(order.data.inventoryHistory).toHaveLength(1);
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects cancellation if the ordered variant is missing, leaving the order and stock unchanged', async () => {
    const { controller, product, order, tx } = fixture({
      stock: 2, variants: [{ id: 'different-variant', name: 'Other', stock: 2 }],
    });
    await expect(controller.updateStatus(request, { status: 'cancelled' } as any)).rejects.toThrow('variant no longer exists');
    expect(order.status).toBe('new');
    expect(product.data).toMatchObject({ stock: 2, variants: [{ id: 'different-variant', stock: 2 }] });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
