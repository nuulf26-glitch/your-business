import { expectedStripeMode, stripeKeyMode, stripeModeMatchesApplication } from '../src/stripe-mode';

describe('Stripe key and application mode safety', () => {
  it.each([
    ['sk_test_fixture', 'test'],
    ['rk_test_fixture', 'test'],
    ['sk_live_fixture', 'live'],
    ['rk_live_fixture', 'live'],
    ['not-a-stripe-key', null],
  ])('classifies %s without revealing the key', (key, expected) => {
    expect(stripeKeyMode(key as string)).toBe(expected);
  });

  it('requires test mode on Render hosts and live mode on production', () => {
    expect(expectedStripeMode('https://getcyb-staging-web.onrender.com')).toBe('test');
    expect(expectedStripeMode('https://cyb-production-web-uzsq.onrender.com')).toBe('test');
    expect(expectedStripeMode('https://getcyb.fit')).toBe('live');
    expect(stripeModeMatchesApplication('sk_test_fixture', 'https://getcyb-staging-web.onrender.com')).toBe(true);
    expect(stripeModeMatchesApplication('sk_live_fixture', 'https://getcyb-staging-web.onrender.com')).toBe(false);
    expect(stripeModeMatchesApplication('sk_test_fixture', 'https://cyb-production-web-uzsq.onrender.com')).toBe(true);
    expect(stripeModeMatchesApplication('sk_live_fixture', 'https://cyb-production-web-uzsq.onrender.com')).toBe(false);
    expect(stripeModeMatchesApplication('sk_test_fixture', 'https://getcyb.fit')).toBe(false);
    expect(stripeModeMatchesApplication('sk_live_fixture', 'https://getcyb.fit')).toBe(true);
  });
});
