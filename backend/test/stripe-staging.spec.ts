import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StripeController } from '../src/routes';

describe('staging Stripe safety diagnostics',()=>{
  const priorUrl=process.env.PUBLIC_APP_URL;
  const priorKey=process.env.STRIPE_SECRET_KEY;
  const priorAmount=process.env.STRIPE_BASIC_AMOUNT;
  const priorCurrency=process.env.STRIPE_CURRENCY;
  const priorFetch=global.fetch;
  afterEach(()=>{
    for(const [key,value] of Object.entries({PUBLIC_APP_URL:priorUrl,STRIPE_SECRET_KEY:priorKey,STRIPE_BASIC_AMOUNT:priorAmount,STRIPE_CURRENCY:priorCurrency})){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
    global.fetch=priorFetch;
    jest.restoreAllMocks();
  });

  it('verifies test mode with a read-only Stripe balance request and preserves the lifetime price',async()=>{
    process.env.PUBLIC_APP_URL='https://getcyb-staging-web.onrender.com';
    process.env.STRIPE_SECRET_KEY='sk_test_fixture_only';
    delete process.env.STRIPE_BASIC_AMOUNT;
    delete process.env.STRIPE_CURRENCY;
    const fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({object:'balance',livemode:false})});
    global.fetch=fetch as any;

    const result=await new StripeController({} as any).stagingStatus();

    expect(result).toEqual({configured:true,testMode:true,verified:true,amountCents:24600,currency:'usd'});
    expect(fetch.mock.calls[0][0]).toBe('https://api.stripe.com/v1/balance');
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('sk_test_fixture_only');
  });

  it('blocks staging checkout before any Stripe request when the configured key is live',async()=>{
    process.env.PUBLIC_APP_URL='https://getcyb-staging-web.onrender.com';
    process.env.STRIPE_SECRET_KEY='sk_live_fixture_only';
    const fetch=jest.fn();
    global.fetch=fetch as any;

    await expect(new StripeController({} as any).createCheckoutSession({user:{id:'staging-owner'}} as any)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the diagnostic route hidden outside staging',async()=>{
    process.env.PUBLIC_APP_URL='https://getcyb.fit';
    await expect(new StripeController({} as any).stagingStatus()).rejects.toBeInstanceOf(NotFoundException);
  });
});
