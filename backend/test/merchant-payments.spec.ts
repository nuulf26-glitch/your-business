import { NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MerchantPaymentSettingsController, PublicMerchantPaymentController, TapGatewayAdapter, decryptMerchantPaymentSecret, encryptMerchantPaymentSecret, tapWebhookHash, validateExternalPaymentTemplate } from '../src/merchant-payments';

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

  it('creates a server-priced hosted Tap checkout once and reuses it for duplicate requests',async()=>{
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY=encryptionKey.toString('hex');process.env.TAP_PLATFORM_TEST_APPROVED='true';process.env.PUBLIC_APP_URL='https://store.example.test';
    const config={provider:'tap',country:'AE',mode:'test',connectionVerifiedAt:'verified',...encryptMerchantPaymentSecret('sk_test_store_key',encryptionKey)};
    const order={id:'order_1',businessId:'biz_1',status:'new',amountCents:6200,currency:'AED',data:{customerActionTokenHash:tokenHash,paymentStatus:'Pending',total:62,customerName:'Test Buyer',email:'buyer@example.test',phone:'+971500000000'}};
    const paymentRecord={id:'payment_1',data:{checkoutUrl:'https://checkout.payments.tap.company/session',tapChargeId:'chg_1'}};
    const findUnique=jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(paymentRecord);
    const create=jest.fn().mockResolvedValue({id:'payment_1'});
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn().mockResolvedValue({data:config,status:'connected'}),findUnique,create,update:jest.fn().mockResolvedValue({})}};
    const fetchMock=jest.fn().mockResolvedValue(new Response(JSON.stringify({id:'chg_1',status:'INITIATED',transaction:{url:'https://checkout.payments.tap.company/session'}}),{status:200}));global.fetch=fetchMock as any;
    const controller=new PublicMerchantPaymentController(db),dto={token,idempotencyKey:'i'.repeat(40)};
    expect(await controller.startTap({} as any,'order_1',dto as any)).toMatchObject({url:'https://checkout.payments.tap.company/session',mode:'test'});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({amount:62,currency:'AED',source:{id:'src_all'},reference:{order:'order_1'}});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).redirect.url).not.toContain(token);
    expect(await controller.startTap({} as any,'order_1',dto as any)).toMatchObject({chargeId:'chg_1'});
    expect(fetchMock).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);
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
    const db:any={order:{findUnique:jest.fn().mockResolvedValue(order)},business:{findUnique:jest.fn().mockResolvedValue({id:'biz_1'})},businessRecord:{findFirst:jest.fn().mockResolvedValue({data:manual})},$transaction:jest.fn(async(callback:any)=>callback(tx))};
    const controller=new PublicMerchantPaymentController(db),input={token,method:'external_payment_link'};
    const result=await controller.startManualPayment('order_2',input as any);
    expect(result).toMatchObject({provider:'external_payment_link',amountCents:12345,currency:'AED',reference:'CYB-order_2',status:'awaiting_confirmation',url:'https://pay.example.com/?amount=123.45&reference=CYB-order_2&currency=AED'});
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({businessId:'biz_1'}),data:expect.objectContaining({data:expect.objectContaining({paymentStatus:'Awaiting manual confirmation'})})}));
    expect(saved[0].data.status).toBe('awaiting_confirmation');
  });
});
