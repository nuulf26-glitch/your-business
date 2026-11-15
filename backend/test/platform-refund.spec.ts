import { PlatformRefundController } from '../src/platform-refund';

describe('platform access refund safety', () => {
  const priorEnv = { ...process.env };
  const originalFetch = global.fetch;
  const request = { user: { id: 'owner-a' } } as any;

  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://getcyb-staging-web.onrender.com';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_only';
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 're_test_fixture' }) })) as any;
  });

  afterEach(() => {
    process.env = { ...priorEnv };
    global.fetch = originalFetch;
  });

  function fixture(paymentOverrides: Record<string, unknown> = {}) {
    const payment = {
      id: 'payment-a',
      provider: 'stripe',
      status: 'COMPLETED',
      createdAt: new Date(),
      metadata: { intent: 'PLATFORM_ACCESS', paymentIntentId: 'pi_test_fixture' },
      ...paymentOverrides,
    };
    const db: any = {
      paymentReference: {
        findMany: jest.fn().mockResolvedValue([payment]),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return { db, controller: new PlatformRefundController(db) };
  }

  it('blocks a live-mode key on staging before contacting Stripe', async () => {
    const { db, controller } = fixture();
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture_only';

    await expect(controller.refund(request)).rejects.toThrow('mode does not match');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refunds with a test key and deactivates one-time access', async () => {
    const { db, controller } = fixture();

    await expect(controller.refund(request)).resolves.toEqual({ success: true, status: 'REFUNDED' });
    expect(global.fetch).toHaveBeenCalledWith('https://api.stripe.com/v1/refunds', expect.objectContaining({ method: 'POST' }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.paymentReference.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-a' },
      data: expect.objectContaining({ status: 'REFUNDED' }),
    }));
    expect(db.subscription.updateMany).toHaveBeenCalledWith({
      where: { userId: 'owner-a' },
      data: { status: 'INACTIVE', billingType: 'ONE_TIME' },
    });
  });

  it('does not contact Stripe when the 30-day refund period has expired', async () => {
    const { controller } = fixture({ createdAt: new Date(Date.now() - 31 * 864e5) });

    await expect(controller.refund(request)).rejects.toThrow('The 30-day refund period has ended');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('treats a previously refunded payment as idempotently complete', async () => {
    const { controller } = fixture({ status: 'REFUNDED' });

    await expect(controller.refund(request)).resolves.toEqual({ success: true, status: 'REFUNDED' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks test-mode refunds when configured for the production domain', async () => {
    const { db, controller } = fixture();
    process.env.PUBLIC_APP_URL = 'https://getcyb.fit';

    await expect(controller.refund(request)).rejects.toThrow('mode does not match');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
