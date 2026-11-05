import { StripeController } from '../src/routes';

describe('Stripe staging checkout authorization and activation', () => {
  const prior = { ...process.env };
  const originalFetch = global.fetch;
  const req = { user: { id: 'owner-a' } } as any;
  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://getcyb-staging-web.onrender.com';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_only';
    delete process.env.STRIPE_BASIC_AMOUNT;
    delete process.env.STRIPE_CURRENCY;
  });
  afterEach(() => { process.env = { ...prior }; global.fetch = originalFetch; });
  function fixture(overrides = {}) {
    const payment = { id: 'p1', provider: 'stripe', providerOrderId: 'cs_test_fixture', userId: 'owner-a', status: 'PENDING', amountCents: 24600, currency: 'USD', ...overrides };
    const db: any = {
      paymentReference: {
        findUnique: jest.fn(async () => payment),
        create: jest.fn(),
        updateMany: jest.fn(async () => {
          if (payment.status !== 'PENDING') return { count: 0 };
          payment.status = 'COMPLETED'; return { count: 1 };
        }),
      },
      subscription: { upsert: jest.fn() },
    };
    db.$transaction = jest.fn(async (fn: any) => fn(db));
    const session = { id: payment.providerOrderId, mode: 'payment', payment_status: 'paid', livemode: false, client_reference_id: 'owner-a', metadata: { userId: 'owner-a', intent: 'PLATFORM_ACCESS' }, currency: 'usd', amount_total: 24600 };
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => session })) as any;
    return { db, session, controller: new StripeController(db) };
  }
  it('creates a one-time $246 checkout with staging success and cancellation URLs', async () => {
    const { db, controller } = fixture();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 'cs_test_fixture', url: 'https://checkout.stripe.com/test-fixture' }) })) as any;
    await controller.createCheckoutSession(req);
    const form = new URLSearchParams((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(form.get('mode')).toBe('payment');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('24600');
    expect(form.get('cancel_url')).toBe('https://getcyb-staging-web.onrender.com/platform-payment?stripe_cancelled=1');
    expect(form.get('success_url')).toContain('https://getcyb-staging-web.onrender.com/platform-payment?session_id=');
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
  it('rejects another account checkout before contacting Stripe', async () => {
    const { controller, db } = fixture({ userId: 'owner-b' });
    await expect(controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' })).rejects.toThrow('not found');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { payment_status: 'unpaid' }, { amount_total: 100 }, { currency: 'eur' },
    { client_reference_id: 'owner-b' }, { metadata: { userId: 'owner-b', intent: 'PLATFORM_ACCESS' } },
    { livemode: true }, { livemode: undefined }, { mode: 'subscription' },
  ])('rejects invalid or unpaid checkout %j', async (invalid) => {
    const { controller, db, session } = fixture(); Object.assign(session, invalid);
    await expect(controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' })).rejects.toThrow('verification failed');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('activates once when confirmation is repeated concurrently', async () => {
    const { controller, db } = fixture();
    await Promise.all([controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' }), controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' })]);
    await controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' });
    expect(db.subscription.upsert).toHaveBeenCalledTimes(1);
    expect(db.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-a' }, update: { status: 'ACTIVE', billingType: 'ONE_TIME' } }));
  });
  it('blocks live-key confirmation before any database or Stripe access', async () => {
    const { controller, db } = fixture(); process.env.STRIPE_SECRET_KEY = 'sk_live_fixture_only';
    await expect(controller.confirmCheckout(req, { sessionId: 'cs_test_fixture' })).rejects.toThrow('test-mode key');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(db.paymentReference.findUnique).not.toHaveBeenCalled();
  });
});
