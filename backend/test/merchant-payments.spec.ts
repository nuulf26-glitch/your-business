import { NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MerchantPaymentSettingsController, PublicMerchantPaymentController, StripeGatewayAdapter, TapGatewayAdapter, decryptMerchantPaymentSecret, encryptMerchantPaymentSecret, stripeByogWebhookValid, tapWebhookHash, validateExternalPaymentTemplate } from '../src/merchant-payments';

const encryptionKey=Buffer.alloc(32,7);
const token='cyb_customer_action_token_for_unit_tests_0001';
const tokenHash=createHash('sha256').update(token).digest('hex');

describe('merchant BYOG payment foundations',()=>{
  const originalFetch=global.fetch;
  const originalKey=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  const originalApproval=process.env.TAP_PLATFORM_TEST_APPROVED;
  afterEach(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;else process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=originalKey;if(originalApproval===undefined)delete process.env.TAP_PLATFORM_TEST_APPROVED;else process.env.TAP_PLATFORM_TEST_APPROVED=originalApproval;jest.restoreAllMocks();});

  it('encrypts merchant API credentials with authenticated encryption and rejects tampering',()=>{
    const encrypted=encryptMerchantPaymentSecret('sk_test_private_merchant_key',encryptionKey);
    expect(encrypted.credentialCiphertext).not.toContain('sk_test_private_merchant_key');
    expect(decryptMerchantPaymentSecret(encrypted,encryptionKey)).toBe('sk_test_private_merchant_key');
    expect(()=>decryptMerchantPaymentSecret({...encrypted,credentialTag:Buffer.alloc(16).toString('base64')},encryptionKey)).toThrow();
  });

  it('sends Tap API calls with merchant bearer credentials and does not include them in errors',async()=>{
    const adapter=new TapGatewayAdapter(),fetchMock=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'chg_test',transaction:{url:'https://checkout.payments.tap.company/test'}}),{status:200}));global.fetch=fetchMock as any;
    const result=await adapter.createCheckout('sk_test_secret_key',{amount:1,currency:'AED'});
    expect(result.id).toBe('chg_test');expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_secret_key');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({code:'AUTH_FAILED'}),{status:401}));
    await expect(adapter.retrieveCharge('sk_test_secret_key','probe')).rejects.toMatchObject({providerStatus:401});
  });

  it('sends Stripe BYOG API requests through the merchant restricted test key with an idempotency key',async()=>{
    const adapter=new StripeGatewayAdapter(),fetchMock=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'cs_test_1'}),{status:200}));global.fetch=fetchMock as any;
    await adapter.createCheckout('rk_test_merchant_key_123456789',new URLSearchParams({mode:'payment'}),'cyb-order-stable');
    expect(fetchMock).toHaveBeenCalledWith('https://api.stripe.com/v1/payment_intents',expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer rk_test_merchant_key_123456789','Idempotency-Key':'cyb-order-stable'})}));
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('sk_live_');
  });

  it('rejects Stripe webhook signatures with stale timestamps or modified payloads',()=>{
    const body=Buffer.from('{"id":"evt_test"}'),timestamp=1_800_000_000,signature=createHash('sha256').update('unused').digest('hex');
    expect(stripeByogWebhookValid(body,`t=${timestamp},v1=${signature}`,'whsec_test',timestamp+301)).toBe(false);
    const hmac=require('node:crypto').createHmac('sha256','whsec_test').update(`${timestamp}.`).update(body).digest('hex');
    expect(stripeByogWebhookValid(body,`t=${timestamp},v1=${hmac}`,'whsec_test',timestamp)).toBe(true);
    expect(stripeByogWebhookValid(Buffer.from('{}'),`t=${timestamp},v1=${hmac}`,'whsec_test',timestamp)).toBe(false);
  });

  it('stores a Stripe restricted test key and webhook secret only as encrypted server-side data',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    let saved:any;const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'biz_1',ownerId:'owner_1'})},businessRecord:{upsert:jest.fn(async(input:any)=>{saved=input.create.data;return saved;})}};
    const result=await new MerchantPaymentSettingsController(db).connectStripe({user:{id:'owner_1'},get:()=> 'biz_1'} as any,{provider:'stripe',country:'AE',restrictedTestKey:'rk_test_secret_key_123456789',publishableKey:'pk_test_publishable_key_123456',webhookSecret:'whsec_secret_value_123456'} as any);
    expect(result).toMatchObject({connected:true,provider:'stripe',mode:'test',country:'AE',liveEnabled:false});expect(JSON.stringify(result)).not.toContain('rk_test_secret_key_123456789');expect(JSON.stringify(result)).not.toContain('whsec_secret_value_123456');
    const decrypted=JSON.parse(decryptMerchantPaymentSecret(saved,encryptionKey));expect(decrypted).toEqual({restrictedTestKey:'rk_test_secret_key_123456789',publishableKey:'pk_test_publishable_key_123456',webhookSecret:'whsec_secret_value_123456'});expect(saved.credentialCiphertext).not.toContain('rk_test_secret_key_123456789');
  });

  it('accepts merchant-owned restricted Stripe test credentials without platform enrollment and rejects live keys',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'biz_1',ownerId:'owner_1'})},businessRecord:{upsert:jest.fn()}};
    await expect(new MerchantPaymentSettingsController(db).connectStripe({user:{id:'owner_1'},get:()=> 'biz_1'} as any,{provider:'stripe',country:'AE',restrictedTestKey:'sk_live_secret_key_123456789',publishableKey:'pk_test_publishable_key_123456',webhookSecret:'whsec_secret_value_123456'} as any)).rejects.toThrow();
    expect(db.businessRecord.upsert).not.toHaveBeenCalled();
    const result=await new MerchantPaymentSettingsController(db).connectStripe({user:{id:'owner_1'},get:()=> 'biz_1'} as any,{provider:'stripe',country:'AE',restrictedTestKey:'rk_test_secret_key_123456789',publishableKey:'pk_test_publishable_key_123456',webhookSecret:'whsec_secret_value_123456'} as any);
    expect(result).toMatchObject({connected:true,mode:'test',liveEnabled:false});expect(db.businessRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it('creates one direct-to-merchant Stripe hosted test checkout at the server order amount',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');process.env.PUBLIC_APP_URL='https://store.example.test';
    const encrypted=encryptMerchantPaymentSecret(JSON.stringify({restrictedTestKey:'rk_test_store_key_123456789',publishableKey:'pk_test_store_pub_123456789',webhookSecret:'whsec_store_secret_123456'}),encryptionKey),config={provider:'stripe',country:'AE',mode:'test',connectionVerifiedAt:'verified',...encrypted};
    const order={id:'order_stripe_1',businessId:'biz_1',status:'new',amountCents:7200,currency:'AED',data:{customerActionTokenHash:tokenHash,paymentStatus:'Pending',email:'buyer@example.test'}};
    const saved:any={id:'payment_stripe_1',data:{stripePaymentIntentId:'pi_test_1'}};
    const findUnique=jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved),create=jest.fn().mockResolvedValue({id:'payment_stripe_1'});
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn(async({where}:any)=>(where.data?.path?.[0]==='provider'||String(where.legacyFirebasePath||'').endsWith(':stripe'))?{data:config,status:'connected'}:null),findUnique,create,update:jest.fn().mockResolvedValue({})}};
    const fetchMock=jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({id:'pi_test_1',livemode:false,status:'requires_payment_method',client_secret:'pi_test_1_secret_example'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({id:'pi_test_1',livemode:false,status:'requires_payment_method',client_secret:'pi_test_1_secret_example',metadata:{cyb_business_id:'biz_1',cyb_order_id:'order_stripe_1'}}),{status:200}));global.fetch=fetchMock as any;
    const controller=new PublicMerchantPaymentController(db),dto={token,idempotencyKey:'i'.repeat(40)};
    expect(await controller.startStripe({} as any,'order_stripe_1',dto as any)).toMatchObject({clientSecret:'pi_test_1_secret_example',publishableKey:'pk_test_store_pub_123456789',paymentIntentId:'pi_test_1',mode:'test'});
    const form=new URLSearchParams(fetchMock.mock.calls[0][1].body);expect(form.get('payment_method_types[0]')).toBe('card');expect(form.get('amount')).toBe('7200');expect(form.get('metadata[cyb_business_id]')).toBe('biz_1');expect(form.has('application_fee_amount')).toBe(false);expect(form.has('transfer_data[destination]')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer rk_test_store_key_123456789');expect(await controller.startStripe({} as any,'order_stripe_1',dto as any)).toMatchObject({paymentIntentId:'pi_test_1'});expect(fetchMock).toHaveBeenCalledTimes(2);expect(create).toHaveBeenCalledTimes(3);
  });

  it('rejects a Stripe checkout when a different payment provider already has an active attempt',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    const encrypted=encryptMerchantPaymentSecret(JSON.stringify({restrictedTestKey:'rk_test_store_key_123456789',publishableKey:'pk_test_store_pub_123456789',webhookSecret:'whsec_store_secret_123456'}),encryptionKey),config={provider:'stripe',country:'AE',mode:'test',connectionVerifiedAt:'verified',...encrypted};
    const order={id:'order_stripe_2',businessId:'biz_1',status:'new',amountCents:5000,currency:'AED',data:{customerActionTokenHash:tokenHash,paymentStatus:'Pending'}};
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn(async({where}:any)=>(where.data?.path?.[0]==='provider'||String(where.legacyFirebasePath||'').endsWith(':stripe'))?{data:config,status:'connected'}:{id:'manual_1',legacyFirebasePath:'manual-payment:biz_1:order_stripe_2',data:{provider:'bank_transfer'}}),findUnique:jest.fn(),create:jest.fn(),update:jest.fn()}};
    const fetchMock=jest.fn();global.fetch=fetchMock as any;
    await expect(new PublicMerchantPaymentController(db).startStripe({} as any,'order_stripe_2',{token,idempotencyKey:'i'.repeat(40)} as any)).rejects.toThrow('bank transfer payment is already pending');
    expect(fetchMock).not.toHaveBeenCalled();expect(db.businessRecord.create).toHaveBeenCalledTimes(1);expect(db.businessRecord.create.mock.calls[0][0].data.type).toBe('merchantPaymentLock');
  });

  it('verifies signed Stripe payment-intent webhooks and counts collection once',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    const encrypted=encryptMerchantPaymentSecret(JSON.stringify({restrictedTestKey:'rk_test_store_key_123456789',publishableKey:'pk_test_store_pub_123456789',webhookSecret:'whsec_store_secret_123456'}),encryptionKey),config={provider:'stripe',country:'AE',mode:'test',...encrypted};
    const paymentRecord={id:'pay_1',businessId:'biz_1',status:'requires_payment_method',data:{provider:'stripe',orderId:'order_1',stripePaymentIntentId:'pi_1',amountCents:4000,currency:'AED'}};
    const order={id:'order_1',businessId:'biz_1',status:'new',amountCents:4000,currency:'AED',data:{paymentStatus:'Pending',email:''}},tx:any={order:{findFirst:jest.fn().mockResolvedValue(order),updateMany:jest.fn().mockResolvedValue({count:1})}};
    const event={id:'evt_1',type:'payment_intent.succeeded',data:{object:{id:'pi_1'}}},body=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(Date.now()/1000),signature=require('node:crypto').createHmac('sha256','whsec_store_secret_123456').update(`${timestamp}.`).update(body).digest('hex');
    const eventRecord={id:'event_1'},findUnique=jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(eventRecord),create=jest.fn().mockResolvedValue(eventRecord),update=jest.fn().mockResolvedValue({});
    const db:any={businessRecord:{findFirst:jest.fn(async({where}:any)=>where.type==='merchantPayment'?paymentRecord:{data:config,status:'connected'}),findUnique,create,update},$transaction:jest.fn(async(callback:any)=>callback(tx))};
    global.fetch=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'pi_1',amount:4000,currency:'aed',livemode:false,status:'succeeded',metadata:{cyb_business_id:'biz_1',cyb_order_id:'order_1'}}),{status:200})) as any;
    const controller=new PublicMerchantPaymentController(db),request={body};
    expect(await controller.handleStripeWebhook(request as any,`t=${timestamp},v1=${signature}`)).toEqual({received:true});
    expect(await controller.handleStripeWebhook(request as any,`t=${timestamp},v1=${signature}`)).toEqual({received:true,duplicate:true});
    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);expect(update).toHaveBeenCalledWith(expect.objectContaining({where:{id:'pay_1'},data:expect.objectContaining({status:'PAID'})}));
  });

  it('records only a provider-verified full Stripe refund from a signed refund webhook',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    const encrypted=encryptMerchantPaymentSecret(JSON.stringify({restrictedTestKey:'rk_test_store_key_123456789',publishableKey:'pk_test_store_pub_123456789',webhookSecret:'whsec_store_secret_123456'}),encryptionKey),config={provider:'stripe',country:'AE',mode:'test',...encrypted};
    const paymentRecord={id:'pay_2',businessId:'biz_1',status:'PAID',data:{provider:'stripe',orderId:'order_2',stripePaymentIntentId:'pi_2',amountCents:4000,currency:'AED',status:'paid'}};
    const order={id:'order_2',businessId:'biz_1',status:'new',amountCents:4000,currency:'AED',data:{paymentStatus:'Paid',collectedAmountCents:4000,paymentHistory:[{type:'collected'}],refundHistory:[],email:''}},tx:any={order:{findFirst:jest.fn().mockResolvedValue(order),updateMany:jest.fn().mockResolvedValue({count:1})}};
    const event={id:'evt_refund_1',type:'refund.updated',data:{object:{id:'re_1',object:'refund',payment_intent:'pi_2',amount:4000,currency:'aed',status:'succeeded'}}};
    const body=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(Date.now()/1000),signature=require('node:crypto').createHmac('sha256','whsec_store_secret_123456').update(`${timestamp}.`).update(body).digest('hex');
    const db:any={businessRecord:{findFirst:jest.fn(async({where}:any)=>where.type==='merchantPayment'?paymentRecord:{data:config,status:'connected'}),findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:'event_refund_1'}),update:jest.fn().mockResolvedValue({})},$transaction:jest.fn(async(callback:any)=>callback(tx))};
    global.fetch=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'pi_2',amount:4000,currency:'aed',livemode:false,status:'succeeded',metadata:{cyb_business_id:'biz_1',cyb_order_id:'order_2'}}),{status:200})) as any;
    expect(await new PublicMerchantPaymentController(db).handleStripeWebhook({body} as any,`t=${timestamp},v1=${signature}`)).toEqual({received:true});
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{data:expect.objectContaining({paymentStatus:'Refunded',refundHistory:[expect.objectContaining({id:'re_1',status:'REFUNDED'})]})}}));
  });

  it('builds Tap webhook HMAC using provider-documented charge values',()=>{
    const payload={id:'chg_1',amount:20,currency:'AED',status:'CAPTURED',transaction:{created:'1700000000'},reference:{gateway:'gw_1',payment:'pay_1'}};
    expect(tapWebhookHash(payload,'secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(tapWebhookHash({...payload,status:'FAILED'},'secret')).not.toBe(tapWebhookHash(payload,'secret'));
  });

  it('stores only an encrypted test key for the selected business and never returns it',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    let saved:any;
    const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'biz_1',ownerId:'owner_1'})},businessRecord:{upsert:jest.fn(async(input:any)=>{saved=input.create.data;return saved;})}};
    const controller=new MerchantPaymentSettingsController(db),result=await controller.connect({user:{id:'owner_1'},get:()=> 'biz_1'} as any,{provider:'tap',country:'AE',secretKey:'sk_test_merchant_secret'} as any);
    expect(result).toMatchObject({connected:true,mode:'test',country:'AE'});expect(JSON.stringify(result)).not.toContain('sk_test_merchant_secret');
    expect(saved.credentialCiphertext).not.toContain('sk_test_merchant_secret');expect(decryptMerchantPaymentSecret(saved,encryptionKey)).toBe('sk_test_merchant_secret');
    expect(db.business.findFirst).toHaveBeenCalledWith({where:{id:'biz_1',ownerId:'owner_1'}});
  });

  it('projects canceled manual payments as terminal without changing stored payment records',async()=>{
    const records=[
      {id:'manual_cancelled',status:'awaiting_confirmation',createdAt:new Date('2026-11-25T00:00:00Z'),data:{provider:'external_payment_link',orderId:'order_cancelled',status:'awaiting_confirmation',amountCents:2600,currency:'USD'}},
      {id:'manual_pending',status:'awaiting_confirmation',createdAt:new Date('2026-11-25T00:01:00Z'),data:{provider:'bank_transfer',orderId:'order_pending',status:'awaiting_confirmation',amountCents:2600,currency:'USD'}},
    ];
    const db:any={
      business:{findFirst:jest.fn().mockResolvedValue({id:'biz_1',ownerId:'owner_1'})},
      businessRecord:{findFirst:jest.fn().mockResolvedValue(null),findMany:jest.fn().mockResolvedValue(records)},
      order:{findMany:jest.fn().mockResolvedValue([{id:'order_cancelled',status:'new',data:{fulfillmentStatus:'cancelled'}}])},
    };
    const result=await new MerchantPaymentSettingsController(db).list({user:{id:'owner_1'},get:()=> 'biz_1'} as any);
    expect(db.order.findMany).toHaveBeenCalledWith({where:{businessId:'biz_1',id:{in:['order_cancelled','order_pending']}},select:{id:true,status:true,data:true}});
    expect(result.transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({id:'manual_cancelled',status:'cancelled'}),
      expect.objectContaining({id:'manual_pending',status:'awaiting_confirmation'}),
    ]));
    expect(records[0].data.status).toBe('awaiting_confirmation');
  });

  it('does not expose Tap checkout until platform authorization and test-key verification are present',async()=>{
    const data={customerActionTokenHash:tokenHash,paymentStatus:'Pending'};
    const order={id:'order_1',businessId:'biz_1',amountCents:4000,currency:'AED',data};
    const config={provider:'tap',country:'AE',mode:'test',connectionVerifiedAt:'2026-11-24T00:00:00Z'};
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn().mockResolvedValue({data:config,status:'connected'})}};
    const controller=new PublicMerchantPaymentController(db);
    delete process.env.TAP_PLATFORM_TEST_APPROVED;
    expect(await controller.methods({query:{token}} as any,'order_1')).toMatchObject({methods:[{id:'cash_on_delivery',enabled:true}]});
    process.env.TAP_PLATFORM_TEST_APPROVED='true';
    expect(await controller.methods({query:{token}} as any,'order_1')).toMatchObject({methods:[{id:'cash_on_delivery'},{id:'tap',mode:'test'}]});
  });

  it('exposes Stripe cards and wallets only for a verified connected UAE merchant on an unpaid AED order',async()=>{
    const order={id:'order_stripe_methods',businessId:'biz_1',amountCents:4000,currency:'AED',data:{customerActionTokenHash:tokenHash,paymentStatus:'Pending'}};
    let connectedConfig:any={provider:'stripe',country:'AE',mode:'test'};
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn(async({where}:any)=>where.legacyFirebasePath?{data:connectedConfig,status:'connected'}:null)}};
    const controller=new PublicMerchantPaymentController(db);
    expect((await controller.methods({query:{token}} as any,order.id).then((value:any)=>value.methods)).some((method:any)=>method.id==='stripe')).toBe(false);
    connectedConfig={...connectedConfig,connectionVerifiedAt:'2026-11-26T00:00:00.000Z'};
    expect(await controller.methods({query:{token}} as any,order.id)).toMatchObject({methods:[{id:'cash_on_delivery'},{id:'stripe',mode:'test',availableMethods:[expect.stringContaining('Visa and Mastercard')]}]});
    order.data.paymentStatus='Paid';
    expect((await controller.methods({query:{token}} as any,order.id).then((value:any)=>value.methods)).some((method:any)=>method.id==='stripe')).toBe(false);
  });

  it('creates a server-priced hosted Tap checkout once and reuses it for duplicate requests',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');process.env.TAP_PLATFORM_TEST_APPROVED='true';process.env.PUBLIC_APP_URL='https://store.example.test';
    const config={provider:'tap',country:'AE',mode:'test',connectionVerifiedAt:'verified',...encryptMerchantPaymentSecret('sk_test_store_key',encryptionKey)};
    const order={id:'order_1',businessId:'biz_1',status:'new',amountCents:6200,currency:'AED',data:{customerActionTokenHash:tokenHash,paymentStatus:'Pending',total:62,customerName:'Test Buyer',email:'buyer@example.test',phone:'+971500000000'}};
    const paymentRecord={id:'payment_1',data:{checkoutUrl:'https://checkout.payments.tap.company/session',tapChargeId:'chg_1'}};
    const findUnique=jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(paymentRecord);
    const create=jest.fn().mockResolvedValue({id:'payment_1'});
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn(async({where}:any)=>(where.data?.path?.[0]==='provider'||String(where.legacyFirebasePath||'').endsWith(':stripe'))?{data:config,status:'connected'}:null),findUnique,create,update:jest.fn().mockResolvedValue({})}};
    const fetchMock=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'chg_1',status:'INITIATED',transaction:{url:'https://checkout.payments.tap.company/session'}}),{status:200}));global.fetch=fetchMock as any;
    const controller=new PublicMerchantPaymentController(db),dto={token,idempotencyKey:'i'.repeat(40)};
    expect(await controller.startTap({} as any,'order_1',dto as any)).toMatchObject({url:'https://checkout.payments.tap.company/session',mode:'test'});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({amount:62,currency:'AED',source:{id:'src_all'},reference:{order:'order_1'}});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).redirect.url).not.toContain(token);
    expect(await controller.startTap({} as any,'order_1',dto as any)).toMatchObject({chargeId:'chg_1'});
    expect(fetchMock).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(3);
  });

  it('records a captured webhook once after re-fetching Tap state and verifies the merchant signature',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');
    const config={provider:'tap',country:'AE',mode:'test',...encryptMerchantPaymentSecret('sk_test_store_key',encryptionKey)};
    const charge={id:'chg_1',object:'charge',status:'CAPTURED',amount:40,currency:'AED',live_mode:false,transaction:{created:'1700000000'},reference:{order:'order_1',gateway:'gw_1',payment:'pay_1'}};
    const order={id:'order_1',businessId:'biz_1',status:'new',amountCents:4000,currency:'AED',data:{paymentStatus:'Pending',email:''}};
    const tx:any={order:{findFirst:jest.fn().mockResolvedValue(order),updateMany:jest.fn().mockResolvedValue({count:1})}};
    const event={id:'evt_1'};
    const paymentRecord={id:'payment_1',businessId:'biz_1',status:'INITIATED',data:{orderId:'order_1',tapChargeId:'chg_1',amountCents:4000,currency:'AED'}};
    const db:any={businessRecord:{findFirst:jest.fn(async({where}:any)=>where.type==='merchantPaymentProvider'?{data:config,status:'connected'}:paymentRecord),findUnique:jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(event),create:jest.fn().mockResolvedValue({id:'event_1'}),update:jest.fn().mockResolvedValue({})},$transaction:jest.fn(async(callback:any)=>callback(tx))};
    global.fetch=jest.fn().mockImplementation(async()=>new Response(JSON.stringify(charge),{status:200})) as any;
    const controller=new PublicMerchantPaymentController(db),signature=tapWebhookHash(charge,'sk_test_store_key');
    expect(await controller.handleWebhook({body:charge} as any,signature)).toMatchObject({received:true});
    expect(await controller.handleWebhook({body:charge} as any,signature)).toMatchObject({received:true,duplicate:true});
    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects payment-method reads with another customer token',async()=>{
    const order={id:'order_1',businessId:'biz_1',data:{customerActionTokenHash:tokenHash}};
    const controller=new PublicMerchantPaymentController({order:{findUnique:jest.fn().mockResolvedValue(order)}} as any);
    await expect(controller.methods({query:{token:'wrong_customer_token_that_is_long_enough_123'}} as any,'order_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts only HTTPS order-specific payment-link templates',()=>{
    expect(validateExternalPaymentTemplate('https://pay.example.com/?amount={amount}&order={order}&currency={currency}')).toBe(true);
    expect(validateExternalPaymentTemplate('http://pay.example.com/?amount={amount}&order={order}')).toBe(false);
    expect(validateExternalPaymentTemplate('https://pay.example.com/')).toBe(false);
    expect(validateExternalPaymentTemplate('https://localhost/pay?amount={amount}&order={order}')).toBe(false);
    expect(validateExternalPaymentTemplate('https://user:pass@pay.example.com/?amount={amount}&order={order}')).toBe(false);
  });

  it('creates an order-specific external payment instruction and never records it as paid',async()=>{
    const data={customerActionTokenHash:tokenHash,paymentStatus:'Pending',total:123.45};
    const order={id:'order_2',businessId:'biz_1',status:'new',amountCents:12345,currency:'AED',data};
    const manual={externalPaymentLink:{enabled:true,urlTemplate:'https://pay.example.com/?amount={amount}&reference={order}&currency={currency}'}};
    const prior:any={};const saved:any[]=[];
    const tx:any={businessRecord:{findUnique:jest.fn(async()=>prior.value||null),create:jest.fn(async({data}:any)=>{prior.value={data:data.data};saved.push(data);return data;})},order:{updateMany:jest.fn().mockResolvedValue({count:1})}};
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn(async({where}:any)=>where.type==='merchantPaymentManualOptions'?{data:manual}:null),findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:'payment-lock'})},$transaction:jest.fn(async(callback:any)=>callback(tx))};
    const controller=new PublicMerchantPaymentController(db),input={token,method:'external_payment_link'};
    const result=await controller.startManualPayment('order_2',input as any);
    expect(result).toMatchObject({provider:'external_payment_link',amountCents:12345,currency:'AED',reference:'CYB-order_2',status:'awaiting_confirmation',url:'https://pay.example.com/?amount=123.45&reference=CYB-order_2&currency=AED'});
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({businessId:'biz_1'}),data:expect.objectContaining({data:expect.objectContaining({paymentStatus:'Awaiting manual confirmation'})})}));
    expect(saved[0].data.status).toBe('awaiting_confirmation');
  });
});
