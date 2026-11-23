import { applyDirectChargeEvent, approvedDirectChargeAccount, directChargeHeaders, validatedDirectChargeAccount } from '../src/connect-direct-charges';

describe('merchant Stripe Connect direct charges', () => {
  const ready = {
    id: 'acct_1234567890',
    country: 'AE',
    charges_enabled: true,
    details_submitted: true,
    payouts_enabled: true,
    capabilities: { card_payments: 'active', transfers: 'active' },
  };

  it('accepts only a Stripe-confirmed charge-ready account', () => {
    expect(validatedDirectChargeAccount(ready)).toBe(ready.id);
    expect(validatedDirectChargeAccount({ ...ready, charges_enabled: false })).toBeNull();
    expect(validatedDirectChargeAccount({ ...ready, details_submitted: false })).toBeNull();
    expect(validatedDirectChargeAccount({ ...ready, capabilities: { card_payments: 'pending' } })).toBeNull();
    expect(approvedDirectChargeAccount(ready, ['AE'])).toBe(ready.id);
    expect(approvedDirectChargeAccount({ ...ready, country: 'US' }, ['AE'])).toBeNull();
    expect(approvedDirectChargeAccount(ready, ['US'])).toBeNull();
    expect(validatedDirectChargeAccount({ ...ready, id: 'acct_bad\nInjected: yes' })).toBeNull();
  });

  it('sets connected account context without platform transfer or commission', () => {
    const headers = directChargeHeaders('sk_test_1234567890', ready.id);
    expect(headers['Stripe-Account']).toBe(ready.id);
    expect(headers.Authorization).toBe('Bearer sk_test_1234567890');
    expect(Object.keys(headers)).not.toContain('transfer_data[destination]');
    expect(Object.keys(headers)).not.toContain('application_fee_amount');
  });

  it('rejects live keys until provider eligibility and launch approval', () => {
    expect(() => directChargeHeaders('sk_live_1234567890', ready.id)).toThrow('test mode');
    expect(() => directChargeHeaders('sk_test_1234567890', 'not-an-account')).toThrow('verified');
  });
});

describe('direct-charge payment accounting', () => {
  const paidEvent = { id: 'evt_paid', type: 'checkout.session.completed', object: { payment_status: 'paid' } };
  it('counts a successful payment once and leaves an unpaid checkout out of revenue', () => {
    const pending = applyDirectChargeEvent({ id: 'evt_open', type: 'checkout.session.completed', object: { payment_status: 'unpaid' } }, { paymentStatus: 'Pending' }, 1200);
    expect(pending.status).toBe('processing');
    expect(pending.nextOrder.paymentHistory).toBeUndefined();
    const paid = applyDirectChargeEvent(paidEvent, { paymentStatus: 'Pending' }, 1200);
    expect(paid.nextOrder.collectedAmountCents).toBe(1200);
    const repeated = applyDirectChargeEvent({ ...paidEvent, id: 'evt_paid_again' }, paid.nextOrder, 1200);
    expect(repeated.nextOrder.paymentHistory.filter((entry: any) => entry.type === 'collected')).toHaveLength(1);
  });
  it('records failures without revenue', () => {
    const result = applyDirectChargeEvent({ id: 'evt_failed', type: 'payment_intent.payment_failed', object: {} }, { paymentStatus: 'Pending' }, 2000);
    expect(result.status).toBe('failed');
    expect(result.nextOrder.paymentStatus).toBe('Failed');
    expect(result.nextOrder.paymentHistory).toBeUndefined();
  });
  it('records refund deltas without double-counting duplicate webhook events', () => {
    const first = applyDirectChargeEvent({ id: 'evt_refund', type: 'charge.refunded', object: { amount_refunded: 500 } }, { paymentStatus: 'Paid', collectedAmountCents: 1000, paymentHistory: [{ type: 'collected', amountCents: 1000 }] }, 1000);
    expect(first.nextOrder.paymentStatus).toBe('Partially refunded');
    expect(first.nextOrder.refundHistory[0].amountCents).toBe(500);
    const duplicate = applyDirectChargeEvent({ id: 'evt_refund', type: 'charge.refunded', object: { amount_refunded: 500 } }, first.nextOrder, 1000);
    expect(duplicate.nextOrder.refundHistory).toHaveLength(1);
  });
});
