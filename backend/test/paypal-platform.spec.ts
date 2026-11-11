import { PayPalController } from '../src/routes';

describe('CYB one-time PayPal platform payment', () => {
  const originalFetch = global.fetch;
  const originalEnvironment = {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    apiBase: process.env.PAYPAL_API_BASE,
    amount: process.env.PAYPAL_BASIC_AMOUNT,
  };

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'sandbox-client';
    process.env.PAYPAL_CLIENT_SECRET = 'sandbox-secret';
    process.env.PAYPAL_API_BASE = 'https://paypal.test';
    process.env.PAYPAL_BASIC_AMOUNT = '246.00';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    const entries: Array<[string, string | undefined]> = [
      ['PAYPAL_CLIENT_ID', originalEnvironment.clientId],
      ['PAYPAL_CLIENT_SECRET', originalEnvironment.clientSecret],
      ['PAYPAL_API_BASE', originalEnvironment.apiBase],
      ['PAYPAL_BASIC_AMOUNT', originalEnvironment.amount],
    ];
    for (const [key, value] of entries) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('creates a $246 USD capture order and stores a pending one-time payment reference', async () => {
    const database = { paymentReference: { create: jest.fn().mockResolvedValue({ id: 'reference' }) } };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'sandbox-access-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'paypal-order' }) });
    global.fetch = fetchMock as any;

    const result = await new PayPalController(database as any).createOrder({ user: { id: 'owner' } } as any);

    expect(result).toEqual({ orderId: 'paypal-order' });
    const orderRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(orderRequest.intent).toBe('CAPTURE');
    expect(orderRequest.purchase_units[0]).toMatchObject({
      reference_id: 'owner',
      custom_id: 'owner',
      amount: { currency_code: 'USD', value: '246.00' },
    });
    expect(database.paymentReference.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      provider: 'paypal', providerOrderId: 'paypal-order', status: 'PENDING', amountCents: 24600, currency: 'USD', userId: 'owner',
    }) });
  });

  it('activates lifetime access only after the provider confirms the exact amount and account', async () => {
    const payment = { id: 'reference', providerOrderId: 'paypal-order', status: 'PENDING', amountCents: 24600, currency: 'USD', userId: 'owner' };
    const database = {
      paymentReference: { findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({}) },
      subscription: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'sandbox-access-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        id: 'paypal-order', status: 'COMPLETED', purchase_units: [{ reference_id: 'owner', payments: { captures: [{ id: 'capture-id', status: 'COMPLETED', amount: { currency_code: 'USD', value: '246.00' } }] } }],
      }) }) as any;

    const result = await new PayPalController(database as any).capture({ user: { id: 'owner' } } as any, { orderId: 'paypal-order' });

    expect(result).toMatchObject({ success: true, status: 'COMPLETED' });
    expect(database.paymentReference.update).toHaveBeenCalledWith({ where: { id: 'reference' }, data: expect.objectContaining({ status: 'COMPLETED', providerCaptureId: 'capture-id' }) });
    expect(database.subscription.upsert).toHaveBeenCalledWith({ where: { userId: 'owner' }, create: expect.objectContaining({ plan: 'BASIC', status: 'ACTIVE', billingType: 'ONE_TIME' }), update: { status: 'ACTIVE', billingType: 'ONE_TIME' } });
  });

  it('does not activate an account when capture amount or currency does not match', async () => {
    const database = {
      paymentReference: { findUnique: jest.fn().mockResolvedValue({ id: 'reference', status: 'PENDING', amountCents: 24600, currency: 'USD', userId: 'owner' }), update: jest.fn() },
      subscription: { upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'sandbox-access-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        id: 'paypal-order', status: 'COMPLETED', purchase_units: [{ reference_id: 'owner', payments: { captures: [{ id: 'capture-id', status: 'COMPLETED', amount: { currency_code: 'USD', value: '2.00' } }] } }],
      }) }) as any;

    await expect(new PayPalController(database as any).capture({ user: { id: 'owner' } } as any, { orderId: 'paypal-order' })).rejects.toThrow('PayPal payment verification failed');
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.paymentReference.update).not.toHaveBeenCalled();
    expect(database.subscription.upsert).not.toHaveBeenCalled();
  });

  it('treats a repeated capture callback as idempotent', async () => {
    const database = {
      paymentReference: { findUnique: jest.fn().mockResolvedValue({ id: 'reference', status: 'COMPLETED', userId: 'owner' }), update: jest.fn() },
      subscription: { upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    global.fetch = jest.fn();

    const result = await new PayPalController(database as any).capture({ user: { id: 'owner' } } as any, { orderId: 'paypal-order' });

    expect(result).toEqual({ success: true, status: 'COMPLETED', orderId: 'paypal-order' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
