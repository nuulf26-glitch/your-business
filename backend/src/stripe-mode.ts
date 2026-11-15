export type StripeMode = 'test' | 'live';

export function stripeKeyMode(key = process.env.STRIPE_SECRET_KEY || ''): StripeMode | null {
  const match = /^(?:sk|rk)_(test|live)_/.exec(key.trim());
  return match ? match[1] as StripeMode : null;
}

export function expectedStripeMode(appUrl = process.env.PUBLIC_APP_URL || ''): StripeMode | null {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'getcyb-staging-web.onrender.com' || url.hostname.endsWith('.onrender.com')) return 'test';
    if (url.hostname === 'getcyb.fit' || url.hostname === 'www.getcyb.fit') return 'live';
  } catch {
    return null;
  }
  return null;
}

export function stripeModeMatchesApplication(key = process.env.STRIPE_SECRET_KEY || '', appUrl = process.env.PUBLIC_APP_URL || '') {
  const configuredMode = stripeKeyMode(key);
  const expectedMode = expectedStripeMode(appUrl);
  return configuredMode !== null && (expectedMode === null || configuredMode === expectedMode);
}
