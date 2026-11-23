import { PublicStripeConnectController } from '../src/public-stripe-connect';
import { tokenHash } from '../src/session';

describe('merchant direct-charge checkout isolation', () => {
  const originalEnv = { key: process.env.STRIPE_SECRET_KEY, enabled: process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED, countries: process.env.STRIPE_CONNECT_APPROVED_COUNTRIES };
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalEnv.key;
    if (originalEnv.enabled === undefined) delete process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED; else process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED = originalEnv.enabled;
    if (originalEnv.countries === undefined) delete process.env.STRIPE_CONNECT_APPROVED_COUNTRIES; else process.env.STRIPE_CONNECT_APPROVED_COUNTRIES = originalEnv.countries;
  });

  it('creates a successful hosted Checkout session in the order owner’s account only', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_key_123';
    process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED = 'true';
    process.env.STRIPE_CONNECT_APPROVED_COUNTRIES = 'AE';
    const order = { id: 'order-owned', businessId: 'business-owned', status: 'new', amountCents: 1250, currency: 'AED', data: { currency: 'AED', paymentStatus: 'Pending', customerActionTokenHash: tokenHash('synthetic-order-token') } };
    const db: any = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      businessRecord: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => where.type === 'stripeConnectAccount'
          ? Promise.resolve({ id: 'connected', businessId: 'business-owned', data: { accountId: 'acct_owned123', country: 'AE' } })
          : Promise.resolve(null)),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_input: any, init?: any) => {
      const headers = init?.headers || {};
      if (!headers['Stripe-Account']) return new Response(JSON.stringify({ id: 'acct_owned123', country: 'AE', charges_enabled: true, payouts_enabled: true, details_submitted: true, capabilities: { card_payments: 'active' } }), { status: 200 });
      return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/test', payment_intent: null }), { status: 200 });
    });
    const controller = new PublicStripeConnectController(db);
    const response = await controller.checkout({ params: { id: 'order-owned' }, query: {}, body: { token: 'synthetic-order-token', accountId: 'acct_attacker999' } } as any);
    expect(response.url).toBe('https://checkout.stripe.com/c/pay/test');
    const connectedRequest = fetchSpy.mock.calls.find(([, init]: any) => init?.headers?.['Stripe-Account']);
    expect(connectedRequest?.[1]?.headers?.['Stripe-Account']).toBe('acct_owned123');
    const body = new URLSearchParams(String(connectedRequest?.[1]?.body));
    expect(body.get('metadata[businessId]')).toBe('business-owned');
    expect(body.has('payment_intent_data[application_fee_amount]')).toBe(false);
    expect(body.has('transfer_data[destination]')).toBe(false);
    expect(db.businessRecord.findFirst.mock.calls[0][0].where.businessId).toBe('business-owned');
  });

  it('does not create a session when the order has no connected account for its own business', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_key_123';
    process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED = 'true';
    const order = { id: 'order-owned', businessId: 'business-owned', status: 'new', amountCents: 1250, currency: 'AED', data: { currency: 'AED', paymentStatus: 'Pending', customerActionTokenHash: tokenHash('synthetic-order-token') } };
    const db: any = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      businessRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const fetchSpy = jest.spyOn(global, 'fetch');
    const controller = new PublicStripeConnectController(db);
    await expect(controller.checkout({ params: { id: 'order-owned' }, query: {}, body: { token: 'synthetic-order-token', accountId: 'acct_other_business' } } as any)).rejects.toThrow('Card payments are unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.businessRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: 'business-owned' }) }));
  });
});
