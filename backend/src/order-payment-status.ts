const terminalFulfillmentStatuses = new Set(['cancelled', 'canceled', 'returned']);
const manualPaymentProviders = new Set(['bank_transfer', 'external_payment_link']);

/**
 * Projects legacy unpaid manual-payment orders into the terminal state their
 * cancellation already represents. This is read-only; persisted records are
 * corrected by the cancellation write path for new cancellations.
 */
export function orderPaymentStatus(data: Record<string, any> | null | undefined, fulfillmentStatus?: unknown): string {
  const value = data || {};
  const paymentStatus = String(value.paymentStatus || 'Pending');
  const fulfillment = String(fulfillmentStatus ?? value.fulfillmentStatus ?? '').trim().toLowerCase();
  const payment = paymentStatus.trim().toLowerCase();
  const provider = String(value.manualPaymentProvider || '').trim().toLowerCase();

  if (
    terminalFulfillmentStatuses.has(fulfillment) &&
    manualPaymentProviders.has(provider) &&
    payment === 'awaiting manual confirmation'
  ) return 'Cancelled';

  return paymentStatus;
}
