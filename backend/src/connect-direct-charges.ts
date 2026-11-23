/**
 * Merchant payments are separate from CYB platform billing.
 * Never create a direct charge unless Stripe has verified the connected account.
 * The browser must never provide the account ID used for charging.
 */
export type ConnectedAccountCapabilities = {
  id?: unknown;
  country?: unknown;
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

export function applyDirectChargeEvent(input: { type: string; id: string; object: any }, orderData: Record<string, any>, amountCents: number) {
  const history = Array.isArray(orderData.paymentHistory) ? orderData.paymentHistory : [];
  let status: 'paid' | 'processing' | 'failed' | 'refunded' | 'expired' = 'processing';
  if (input.type === 'checkout.session.completed' || input.type === 'checkout.session.async_payment_succeeded') {
    status = input.object?.payment_status === 'paid' || input.type === 'checkout.session.async_payment_succeeded' ? 'paid' : 'processing';
  } else if (input.type === 'checkout.session.expired') {
    status = 'expired';
  } else if (input.type === 'checkout.session.async_payment_failed' || input.type === 'payment_intent.payment_failed') {
    status = 'failed';
  } else if (input.type === 'charge.refunded' && ['paid', 'partially refunded'].includes(String(orderData.paymentStatus || '').toLowerCase())) {
    status = 'refunded';
  } else if (String(orderData.paymentStatus || '').toLowerCase() === 'refunded') {
    status = 'refunded';
  }
  const now = new Date().toISOString();
  const nextOrder: Record<string, any> = { ...orderData, paymentMethod: 'stripe_direct' };
  if (status === 'paid') {
    nextOrder.paymentStatus = 'Paid';
    if (!history.some((entry: any) => entry.type === 'collected')) {
      nextOrder.collectedAmountCents = amountCents;
      nextOrder.paidAt = now;
      nextOrder.paymentHistory = [...history, { type: 'collected', amountCents, method: 'stripe_direct', recordedAt: now, sourceEventId: input.id }];
    }
  } else if (status === 'refunded') {
    const alreadyRefunded = (Array.isArray(orderData.refundHistory) ? orderData.refundHistory : []).reduce((sum: number, entry: any) => sum + (Number(entry.amountCents) || 0), 0);
    const cumulativeRefunded = Math.min(Number(input.object?.amount_refunded || amountCents), amountCents);
    const delta = Math.max(0, cumulativeRefunded - alreadyRefunded);
    const refundedAmount = cumulativeRefunded >= amountCents ? 'Refunded' : 'Partially refunded';
    nextOrder.paymentStatus = refundedAmount;
    if (delta > 0 && !history.some((entry: any) => entry.type === 'refund' && entry.sourceEventId === input.id)) {
      nextOrder.refundHistory = [...(Array.isArray(orderData.refundHistory) ? orderData.refundHistory : []), { amountCents: delta, status: 'succeeded', recordedAt: now, sourceEventId: input.id }];
      nextOrder.paymentHistory = [...history, { type: 'refund', amountCents: delta, recordedAt: now, sourceEventId: input.id }];
    }
  } else if (status === 'expired') {
    nextOrder.paymentStatus = 'Pending';
  } else if (status === 'failed') {
    nextOrder.paymentStatus = String(orderData.paymentStatus || '').toLowerCase() === 'paid' ? orderData.paymentStatus : 'Failed';
  } else {
    nextOrder.paymentStatus = orderData.paymentStatus || 'Processing';
  }
  return { status, nextOrder };
}

export function approvedDirectChargeAccount(account: ConnectedAccountCapabilities, countries: string[]): string | null {
  if (typeof account.country !== 'string' || !countries.map((country) => country.toUpperCase()).includes(account.country.toUpperCase())) return null;
  return validatedDirectChargeAccount(account);
}
