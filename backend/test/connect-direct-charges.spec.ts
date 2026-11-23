import { directChargeHeaders, validatedDirectChargeAccount } from '../src/connect-direct-charges';

describe('merchant Stripe Connect direct charges', () => {
  const ready = {
    id: 'acct_1234567890',
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
