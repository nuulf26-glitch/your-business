import { orderPaymentStatus } from '../src/order-payment-status';
import { CustomerController, OrderController, PublicOrderController } from '../src/routes';
import { CrmController } from '../src/crm';
import { collectedCents, refundedCents } from '../src/analytics';
import { createHash } from 'node:crypto';

describe('order payment status projection', () => {
  it('projects canceled bank-transfer and external-link orders as canceled', () => {
    for (const provider of ['bank_transfer', 'external_payment_link']) {
      expect(orderPaymentStatus({
        fulfillmentStatus: 'cancelled',
        manualPaymentProvider: provider,
        paymentStatus: 'Awaiting manual confirmation',
      })).toBe('Cancelled');
    }
  });

  it('keeps awaiting status for active orders and preserves collected/refund statuses', () => {
    expect(orderPaymentStatus({ fulfillmentStatus: 'new', manualPaymentProvider: 'bank_transfer', paymentStatus: 'Awaiting manual confirmation' })).toBe('Awaiting manual confirmation');
    expect(orderPaymentStatus({ fulfillmentStatus: 'cancelled', manualPaymentProvider: 'external_payment_link', paymentStatus: 'Paid' })).toBe('Paid');
    expect(orderPaymentStatus({ fulfillmentStatus: 'cancelled', manualPaymentProvider: 'external_payment_link', paymentStatus: 'Refunded' })).toBe('Refunded');
  });

  it('does not rewrite unrelated payment methods when their order is canceled', () => {
    expect(orderPaymentStatus({ fulfillmentStatus: 'cancelled', paymentMethod: 'cash', paymentStatus: 'Cash on delivery' })).toBe('Cash on delivery');
    expect(orderPaymentStatus({ fulfillmentStatus: 'returned', paymentStatus: 'Pending' })).toBe('Pending');
  });

  it('returns the same terminal payment state from Orders, customer history, tracking, CRM, and provider accounting', async () => {
    const createdAt = new Date('2026-11-25T00:00:00.000Z');
    const canceled = { id: 'order_canceled', businessId: 'biz_1', status: 'cancelled', amountCents: 1000, currency: 'AED', createdAt, data: {
      email: 'buyer@example.com', fulfillmentStatus: 'cancelled', manualPaymentProvider: 'bank_transfer',
      paymentStatus: 'Awaiting manual confirmation', total: 10, customerName: 'Test Buyer', items: [], customerActionTokenHash: createHash('sha256').update('valid-test-token').digest('hex'),
    } };
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'biz_1', ownerId: 'owner_1' }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer_1', businessId: 'biz_1', data: { email: 'buyer@example.com' } }) },
      order: {
        findMany: jest.fn().mockResolvedValue([canceled]),
        findFirst: jest.fn().mockResolvedValue(canceled),
        findUnique: jest.fn().mockResolvedValue(canceled),
      },
      businessRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const req: any = { user: { id: 'owner_1' }, get: () => 'biz_1', headers: {}, query: {}, params: { id: 'order_canceled' } };

    const orderList = await new OrderController(db).list(req) as any[];
    const orderDetail = await new OrderController(db).one(req) as any;
    const customer = await new CustomerController(db).one(req) as any;
    const tracking = await new PublicOrderController(db).customerTracking({ params: { id: 'order_canceled' }, query: { token: 'valid-test-token' } } as any) as any;
    const crm = await new CrmController(db).activity(req, 'customer_1') as any[];

    expect(orderList[0].data.paymentStatus).toBe('Cancelled');
    expect(orderDetail.paymentStatus).toBe('Cancelled');
    expect(customer.orders[0].paymentStatus).toBe('Cancelled');
    expect(tracking.paymentStatus).toBe('Cancelled');
    expect(crm.find(event => event.kind === 'store_order')).toMatchObject({ status: 'cancelled', paymentStatus: 'Cancelled', financial: { collected: 0, refunded: 0, net: 0 } });
    expect(collectedCents(canceled)).toBe(0);

    const collectedAndRefunded = { amountCents: 10000, data: {
      paymentStatus: 'Refunded', collectedAmountCents: 10000,
      paymentHistory: [{ type: 'collected', amountCents: 10000 }],
      refundHistory: [{ amountCents: 2500 }],
    } };
    expect(collectedCents(collectedAndRefunded)).toBe(10000);
    expect(refundedCents(collectedAndRefunded)).toBe(2500);
  });
});
