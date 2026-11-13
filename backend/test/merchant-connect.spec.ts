import { MerchantConnectController } from '../src/merchant-connect';

describe('merchant Connect test onboarding boundaries', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  let db: any, controller: MerchantConnectController, responses: any[], request: jest.Mock;
  const req = { user: { id: 'owner-a' } } as any;
  const response = () => ({ setHeader: jest.fn() } as any);
  const account = () => ({ object: 'account', id: 'acct_A', country: 'AE', type: 'custom', metadata: { cybBusinessId: 'biz-a' }, charges_enabled: true, payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: { currently_due: [], past_due: [] } });
  beforeEach(() => {
    process.env = { ...originalEnv, PUBLIC_APP_URL: 'https://getcyb-staging-web.onrender.com',
      STRIPE_CONNECT_TEST_ONBOARDING_ENABLED: 'true', STRIPE_CONNECT_UAE_CONFIGURATION_CONFIRMED: 'true',
      STRIPE_CONNECT_TEST_SECRET_KEY: 'sk_test_fixture', STRIPE_CONNECT_TEST_PLATFORM_ACCOUNT: 'acct_PLATFORM',
      STRIPE_CONNECT_TEST_ACCOUNT_BINDINGS: JSON.stringify({ 'biz-a': 'acct_A', 'biz-b': 'acct_B' }) };
    db = { business: { findFirst: jest.fn(async () => ({ id: 'biz-a' })) } };
    controller = new MerchantConnectController(db);
    responses = [{ object: 'balance', livemode: false }, { id: 'acct_PLATFORM' }, account()];
    request = jest.fn(async () => ({ ok: true, json: async () => responses.shift() }));
    global.fetch = request;
  });
  afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

  it.each(['STRIPE_CONNECT_TEST_ONBOARDING_ENABLED', 'STRIPE_CONNECT_UAE_CONFIGURATION_CONFIRMED'])('stays closed without %s, even when platform lifetime Stripe is configured', async key => {
    delete process.env[key]; process.env.STRIPE_SECRET_KEY = 'sk_test_lifetime';
    expect(await controller.status(req, response())).toMatchObject({ connectionStatus: 'disabled', cardEnabled: false });
    await expect(controller.onboarding(req, response())).rejects.toThrow('not configured or approved');
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    ['STRIPE_CONNECT_TEST_SECRET_KEY', 'sk_live_secret'],
    ['STRIPE_CONNECT_TEST_SECRET_KEY', ''],
    ['PUBLIC_APP_URL', 'https://getcyb.fit'],
  ])('rejects unsafe %s configuration', async (key, value) => {
    process.env[key] = value;
    await expect(controller.onboarding(req, response())).rejects.toThrow('not configured or approved');
    expect(request).not.toHaveBeenCalled();
  });
  it('derives the merchant from the session and never enables card checkout', async () => {
    const res = response();
    expect(await controller.status(req, res)).toMatchObject({ connectionStatus: 'verified_test_connection', checkoutEnabled: false, walletsEnabled: false });
    expect(db.business.findFirst).toHaveBeenCalledWith({ where: { ownerId: 'owner-a' } });
    expect(request.mock.calls[2][0]).toBe('https://api.stripe.com/v1/accounts/acct_A');
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_fixture');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it('does not let a merchant without a binding access another merchant account', async () => {
    db.business.findFirst.mockResolvedValue({ id: 'biz-unbound' });
    expect(await controller.status(req, response())).toMatchObject({ connectionStatus: 'not_connected' });
    await expect(controller.onboarding(req, response())).rejects.toThrow('No approved merchant');
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects duplicate account bindings', async () => {
    process.env.STRIPE_CONNECT_TEST_ACCOUNT_BINDINGS = '{"biz-a":"acct_A","biz-b":"acct_A"}';
    await expect(controller.status(req, response())).rejects.toThrow('bindings are invalid');
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['platform', 'metadata', 'country', 'type', 'mode'])('refuses a mismatched %s before generating an onboarding link', async fault => {
    if (fault === 'platform') responses[1].id = 'acct_OTHER';
    if (fault === 'metadata') responses[2].metadata.cybBusinessId = 'biz-b';
    if (fault === 'country') responses[2].country = 'US';
    if (fault === 'type') responses[2].type = 'standard';
    if (fault === 'mode') responses[0].livemode = true;
    await expect(controller.onboarding(req, response())).rejects.toThrow();
    expect(request.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
  });
  it('requires outstanding requirements to be completed', async () => {
    responses[2].requirements.currently_due = ['company.tax_id'];
    expect(await controller.status(req, response())).toMatchObject({ connectionStatus: 'requirements_due', checkoutEnabled: false });
  });
  it('uses only the session merchant and fixed staging callback URLs for onboarding', async () => {
    responses.push({ url: 'https://connect.stripe.com/setup/test_link' });
    expect(await controller.onboarding(req, response())).toEqual({ url: 'https://connect.stripe.com/setup/test_link' });
    const [url, init] = request.mock.calls[3];
    expect(url).toBe('https://api.stripe.com/v1/account_links');
    const body = new URLSearchParams(init.body);
    expect(body.get('account')).toBe('acct_A');
    expect(body.get('return_url')).toBe('https://getcyb-staging-web.onrender.com/settings?merchant_connect=return');
    expect(body.get('type')).toBe('account_onboarding');
    expect(request.mock.calls.some(([url]) => /checkout|payment_intents|transfers/.test(url))).toBe(false);
  });
  it('rejects an unexpected onboarding destination', async () => {
    responses.push({ url: 'https://example.com/phishing' });
    await expect(controller.onboarding(req, response())).rejects.toThrow('Invalid merchant onboarding response');
  });
  it('does not expose provider errors or credentials', async () => {
    request.mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'private details sk_test_fixture' } }) });
    await expect(controller.onboarding(req, response())).rejects.toThrow('Merchant payment provider is unavailable.');
  });
});
