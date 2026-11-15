import { createHmac } from 'node:crypto';
import { StripeWebhookController } from '../src/routes';

describe('Stripe signed webhook activation',()=>{
  const previous={...process.env};
  const secret='whsec_fixture_only';
  beforeEach(()=>{process.env.STRIPE_WEBHOOK_SECRET=secret;process.env.STRIPE_SECRET_KEY='sk_test_fixture_only';process.env.PUBLIC_APP_URL='https://getcyb-staging-web.onrender.com';});
  afterEach(()=>{process.env={...previous};});
  function setup(){
    const payment={id:'payment',providerOrderId:'cs_test',provider:'stripe',userId:'owner',status:'PENDING',amountCents:24600,currency:'USD'};
    const db:any={paymentReference:{findUnique:jest.fn(async()=>payment),updateMany:jest.fn(async()=>{if(payment.status==='COMPLETED')return {count:0};payment.status='COMPLETED';return {count:1};})},subscription:{upsert:jest.fn()}};
    db.$transaction=jest.fn(async(fn:any)=>fn(db));
    const event={id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test',livemode:false,mode:'payment',payment_status:'paid',client_reference_id:'owner',metadata:{userId:'owner',intent:'PLATFORM_ACCESS'},amount_total:24600,currency:'usd'}}};
    return {db,event,controller:new StripeWebhookController(db)};
  }
  function request(event:unknown,age=0){
    const body=Buffer.from(JSON.stringify(event)),t=String(Math.floor(Date.now()/1000)-age);
    const hash=createHmac('sha256',secret).update(t+'.').update(body).digest('hex');
    return {body,headers:{'stripe-signature':`t=${t},v1=${hash}`}} as any;
  }
  it('rejects tampered payloads before reading payments',async()=>{
    const {db,event,controller}=setup();const req=request(event);req.body=Buffer.from(JSON.stringify({...event,id:'tampered'}));
    await expect(controller.receive(req)).rejects.toThrow('Invalid Stripe signature');expect(db.paymentReference.findUnique).not.toHaveBeenCalled();
  });
  it.each([301,-301])('rejects stale or future timestamps (%s)',async(age)=>{
    const {event,controller}=setup();await expect(controller.receive(request(event,age))).rejects.toThrow('Invalid Stripe signature');
  });
  it('rejects missing signatures and already-parsed bodies',async()=>{
    const {event,controller}=setup();await expect(controller.receive({body:Buffer.from('{}'),headers:{}} as any)).rejects.toThrow('Invalid Stripe signature');
    const req=request(event);req.body=event;await expect(controller.receive(req)).rejects.toThrow('Invalid Stripe signature');
  });
  it('accepts key-rotation signatures and activates only once across event redelivery',async()=>{
    const {db,event,controller}=setup();const req=request(event);req.headers['stripe-signature']+=`,v1=${'0'.repeat(64)}`;
    await Promise.all([controller.receive(req),controller.receive(req)]);await controller.receive(req);
    expect(db.subscription.upsert).toHaveBeenCalledTimes(1);
  });
  it.each([{livemode:true},{amount_total:100},{currency:'eur'},{client_reference_id:'another-owner'}])('rejects invalid paid sessions %j',async(invalid)=>{
    const {db,event,controller}=setup();Object.assign(event.data.object,invalid);
    await expect(controller.receive(request(event))).rejects.toThrow('verification failed');expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
  it('rejects live events on staging and ignores unpaid completion events',async()=>{
    const {db,event,controller}=setup();event.livemode=true;await expect(controller.receive(request(event))).rejects.toThrow('test-mode');
    event.livemode=false;event.data.object.payment_status='unpaid';expect(await controller.receive(request(event))).toEqual({received:true});expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
  it('returns retryable failure if the webhook arrives before the local reference exists',async()=>{
    const {db,event,controller}=setup();db.paymentReference.findUnique.mockResolvedValue(null);
    await expect(controller.receive(request(event))).rejects.toThrow('reference is not ready');
  });
});
