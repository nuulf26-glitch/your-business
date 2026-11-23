/**
 * Merchant payments are separate from CYB platform billing.
 * Never create a direct charge unless Stripe has verified the connected account.
 * The browser must never provide the account ID used for charging.
 */
export type ConnectedAccountCapabilities = {
  id?: unknown;
  charges_enabled?: unknown;
  payouts_enabled?: unknown;
  details_submitted?: unknown;
  capabilities?: { card_payments?: unknown; transfers?: unknown } | null;
};

export function validatedDirectChargeAccount(account: ConnectedAccountCapabilities): string | null {
  if (typeof account.id !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(account.id)) return null;
  if (account.charges_enabled !== true || account.payouts_enabled !== true || account.details_submitted !== true) return null;
  if (account.capabilities?.card_payments !== 'active') return null;
  return account.id;
}

/** Direct charges must use the merchant's connected account context.
 * Do not set transfer_data[destination] or application_fee_amount.
 */
export function directChargeHeaders(platformSecretKey: string, verifiedAccountId: string): Record<string, string> {
  if (!/^sk_test_[A-Za-z0-9]+$/.test(platformSecretKey)) {
    throw new Error('Direct-charge integration is restricted to Stripe test mode until approved');
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(verifiedAccountId)) {
    throw new Error('A verified Stripe connected account is required');
  }
  return {
    Authorization: `Bearer ${platformSecretKey}`,
    'Stripe-Account': verifiedAccountId,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}
