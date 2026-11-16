import { PublicOrderController } from '../src/routes';
import { tokenHash } from '../src/session';

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

    const result = await controller.create({ data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com',
      items: [{ productId: 'prod_1', quantity: 1, price: 0.01 }], total: 0.01,
    } });

    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amountCents: 3500, currency: 'USD' }),
    }));
    const stored = tx.order.create.mock.calls[0][0].data.data;
    expect(tx.customer.create.mock.calls[0][0].data.data).toMatchObject({ totalSpent: 0, paidOrders: 0, orders: 1 });
    expect(stored.subtotal).toBe(10);
    expect(stored.shipping).toBe(25);
    expect(stored.total).toBe(35);
    expect(stored.customerActionTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result).toHaveProperty('cashOnDeliveryToken');
    expect(result).not.toHaveProperty('customerActionTokenHash');
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
    expect(update.where).toEqual({ id: 'order_1', status: 'new', data: { equals: row.data } });
    expect(update.data.data).toMatchObject({ total: 35, status: 'New', paymentStatus: 'Cash on delivery', paymentMethod: 'cash' });
    expect(update.data.data.customerActionTokenHash).toBe(tokenHash(token));
  });

  it('does not allow a repeated COD confirmation to overwrite a later collected payment', async () => {
    const token = 'authorized-order-action-token-1234567890';
    const row = { id: 'order_1', status: 'new', data: { customerActionTokenHash: tokenHash(token), paymentStatus: 'Paid' } };
    const db: any = { order: { findUnique: jest.fn().mockResolvedValue(row), updateMany: jest.fn() } };
    await expect(new PublicOrderController(db).setCashOnDelivery({ params: { id: row.id } } as any, { token } as any)).rejects.toThrow('Order not found');
    expect(db.order.updateMany).not.toHaveBeenCalled();
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
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await new PublicOrderController(db).create({ data: {
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
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await new PublicOrderController(db).create({ data: {
      storeUrl: 'sample-shop', customerName: 'A Customer', email: 'a@example.com', items: [{ productId: 'prod_1', quantity: 1 }],
    } });

    const order = tx.order.create.mock.calls[0][0].data;
    expect(order.data.items[0].price).toBe(10);
    expect(order.amountCents).toBe(3500);
  });

  it('uses the selected server-side variant price and rejects insufficient stock', async () => {
    const tx:any={
      order:{create:jest.fn().mockResolvedValue({id:'order_variant',status:'new',createdAt:new Date(),data:{}})},
      product:{
        findFirst:jest.fn().mockResolvedValue({id:'prod_1',businessId:'biz_1',data:{sellingPrice:10,stock:4,variants:[{id:'large',name:'Large',sellingPrice:15,stock:2}]}}),
        updateMany:jest.fn().mockResolvedValue({count:1}),
      },
      customer:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({})},
    };
    const db:any={
      business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1',slug:'sample-shop',settings:{},website:{published:{}}})},
      product:{findMany:jest.fn().mockResolvedValue([{id:'prod_1',name:'Item',data:{sellingPrice:10,stock:4,variants:[{id:'large',name:'Large',sellingPrice:15,stock:2}]}}])},
      $transaction:jest.fn(async(callback:any)=>callback(tx)),
    };
    await new PublicOrderController(db).create({data:{storeUrl:'sample-shop',customerName:'A Customer',email:'a@example.com',items:[{productId:'prod_1',variantId:'large',quantity:1} ]}});
    const order=tx.order.create.mock.calls[0][0].data;
    expect(order.data.items[0]).toMatchObject({id:'prod_1',variantId:'large',variantName:'Large',price:15,quantity:1});
    expect(order.amountCents).toBe(4000);
    expect(tx.product.updateMany.mock.calls[0][0].where).toEqual({id:'prod_1',businessId:'biz_1',data:{equals:{sellingPrice:10,stock:4,variants:[{id:'large',name:'Large',sellingPrice:15,stock:2}]}}});
    expect(tx.product.updateMany.mock.calls[0][0].data.data.variants[0].stock).toBe(1);

    await expect(new PublicOrderController({
      business:db.business,
      product:{findMany:jest.fn().mockResolvedValue([{id:'prod_1',name:'Item',data:{sellingPrice:10,stock:0}}])},
    } as any).create({data:{storeUrl:'sample-shop',customerName:'A Customer',email:'a@example.com',items:[{productId:'prod_1',quantity:1}]}})).rejects.toThrow('out of stock');
  });

  it('rejects checkout when inventory changes to insufficient stock before reservation', async () => {
    const tx:any={
      product:{
        findFirst:jest.fn().mockResolvedValue({id:'prod_1',businessId:'biz_1',data:{sellingPrice:10,stock:0}}),
        updateMany:jest.fn(),
      },
      order:{create:jest.fn()},
    };
    const db:any={
      business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1',slug:'sample-shop',website:{published:{}}})},
      product:{findMany:jest.fn().mockResolvedValue([{id:'prod_1',name:'Item',data:{sellingPrice:10,stock:2}}])},
      $transaction:jest.fn(async(callback:any)=>callback(tx)),
    };
    await expect(new PublicOrderController(db).create({data:{storeUrl:'sample-shop',customerName:'A Customer',email:'a@example.com',items:[{productId:'prod_1',quantity:1}]}})).rejects.toThrow('out of stock');
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('applies merchant currency, shipping, tax, and discount settings server-side', async () => {
    const tx:any={
      order:{findMany:jest.fn().mockResolvedValue([]),create:jest.fn().mockResolvedValue({id:'order_config',status:'new',createdAt:new Date(),data:{}})},
      customer:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({})},
    };
    const db:any={
      business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1',slug:'sample-shop',settings:{commerceSettings:{currency:'AED',shippingZones:[{countryCodes:['AE'],fee:5}],taxEnabled:true,taxRatePercent:5,discounts:[{code:'WELCOME',type:'percent',value:10,usageLimit:2}]}},website:{published:{}}})},
      product:{findMany:jest.fn().mockResolvedValue([{id:'prod_1',name:'Item',data:{sellingPrice:100}}])},
      $transaction:jest.fn(async(callback:any)=>callback(tx)),
    };
    await new PublicOrderController(db).create({data:{storeUrl:'sample-shop',customerName:'A Customer',email:'a@example.com',countryCode:'AE',discountCode:'welcome',items:[{productId:'prod_1',quantity:1}]}});
    const saved=tx.order.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({currency:'AED',amountCents:9950});
    expect(saved.data).toMatchObject({subtotal:100,shipping:5,discount:10,tax:4.5,total:99.5,discountCode:'WELCOME'});
  });

  it('rejects a discount after its configured order usage limit is reached', async () => {
    const tx:any={order:{findMany:jest.fn().mockResolvedValue([{status:'new',data:{discountCode:'WELCOME'} }]),create:jest.fn()},customer:{findFirst:jest.fn(),create:jest.fn()}};
    const db:any={
      business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1',slug:'sample-shop',settings:{commerceSettings:{discounts:[{code:'WELCOME',type:'fixed',value:5,usageLimit:1}]}},website:{published:{}}})},
      product:{findMany:jest.fn().mockResolvedValue([{id:'prod_1',name:'Item',data:{sellingPrice:20}}])},
      $transaction:jest.fn(async(callback:any)=>callback(tx)),
    };
    await expect(new PublicOrderController(db).create({data:{storeUrl:'sample-shop',customerName:'A Customer',email:'a@example.com',discountCode:'WELCOME',items:[{productId:'prod_1',quantity:1}]}})).rejects.toThrow('usage limit');
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
