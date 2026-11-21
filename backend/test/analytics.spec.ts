import { analyticsTestHelpers } from '../src/analytics';
import { AnalyticsController } from '../src/analytics';
const {deviceFrom,browserFrom,sourceHost,collectedCents,refundedCents,localDate}=analyticsTestHelpers();
describe('analytics privacy and revenue calculations',()=>{
  it('counts only confirmed collections and subtracts partial refunds once',()=>{
    const order={amountCents:5000,data:{paymentStatus:'paid',paymentHistory:[{type:'collected',amountCents:5000},{type:'collected',amountCents:5000}],refundHistory:[{amountCents:1200}]}};
    expect(collectedCents(order)).toBe(10000);
    expect(refundedCents(order)).toBe(1200);
    expect(collectedCents({amountCents:5000,data:{paymentStatus:'Cash on delivery',total:50}})).toBe(0);
    expect(collectedCents({amountCents:5000,data:{paymentStatus:'pending',total:50}})).toBe(0);
  });
  it('uses legacy paid status only when no payment ledger exists',()=>{
    expect(collectedCents({amountCents:2450,data:{paymentStatus:'refunded',refundedAmountCents:500}})).toBe(2450);
    expect(refundedCents({data:{refundHistory:[{amountCents:400},{amountCents:-20}]}})).toBe(400);
  });
  it('classifies devices and browsers without retaining raw user agents',()=>{
    expect(deviceFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')).toBe('mobile');
    expect(deviceFrom('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet');
    expect(browserFrom('Mozilla/5.0 Chrome/128.0 Safari/537.36')).toBe('Chrome');
    expect(browserFrom('Mozilla/5.0 Version/17.0 Safari/605.1')).toBe('Safari');
    expect(sourceHost('https://www.example.com/path?email=user@example.com')).toBe('www.example.com');
    expect(sourceHost('javascript:alert(1)')).toBe('direct');
  });
  it('groups day boundaries in the business time zone',()=>{
    expect(localDate(new Date('2026-01-01T22:30:00.000Z'),'Asia/Dubai')).toBe('2026-01-02');
    expect(localDate(new Date('2026-01-01T22:30:00.000Z'),'America/Los_Angeles')).toBe('2026-01-01');
  });
});

describe('merchant scoped analytics controller',()=>{
  it('aggregates collected payments and refunds by business and excludes unpaid COD',async()=>{
    const business={id:'merchant-a',ownerId:'owner-a',settings:{businessCatalog:{timeZone:'UTC',analyticsEnabled:true}}};
    const paid={id:'order-paid',businessId:business.id,createdAt:new Date('2026-11-20T12:00:00Z'),status:'paid',amountCents:10000,data:{paymentStatus:'Paid',paymentHistory:[{type:'collected',amountCents:10000,recordedAt:'2026-11-20T13:00:00Z'}],refundHistory:[{amountCents:2500,recordedAt:'2026-11-21T09:00:00Z'}],items:[{id:'p1',name:'Oil',quantity:2,price:50}],email:'buyer@example.test'}};
    const cod={id:'order-cod',businessId:business.id,createdAt:new Date('2026-11-20T14:00:00Z'),status:'pending',data:{paymentStatus:'Cash on delivery',total:80,items:[{id:'p2',name:'Unpaid item',quantity:1,price:80}]}};
    const records:any[]=[{id:'v1',businessId:business.id,type:'analyticsEvent',createdAt:new Date('2026-11-20T10:00:00Z'),data:{type:'page_view',page:'/',visitorKey:'anon-a',source:'direct',device:'mobile',browser:'Safari'}},{id:'v2',businessId:business.id,type:'analyticsEvent',createdAt:new Date('2026-11-20T11:00:00Z'),data:{type:'page_view',page:'/about',visitorKey:'anon-a',source:'example.test',device:'mobile',browser:'Safari'}},{id:'lead',businessId:business.id,type:'crmLead',status:'won',createdAt:new Date('2026-11-20T12:00:00Z'),data:{}}];
    const scoped=jest.fn(async({where}:any)=>records.filter(row=>row.businessId===where.businessId&&(!where.type||row.type===where.type||where.type.in?.includes(row.type))));
    const db:any={business:{findFirst:jest.fn(async({where}:any)=>where.ownerId==='owner-a'?business:null)},order:{findMany:jest.fn(async({where}:any)=>where.businessId===business.id?[paid,cod]:[])},customer:{findMany:jest.fn(async({where}:any)=>where.businessId===business.id?[{id:'c1',createdAt:new Date('2026-11-20T12:00:00Z')}]:[])},businessRecord:{findMany:scoped}};
    const controller=new AnalyticsController(db),req:any={user:{id:'owner-a'},get:()=>''};
    const report=await controller.overview(req,{from:'2026-11-20',to:'2026-11-21',interval:'daily',timeZone:'UTC'});
    expect(report.current).toMatchObject({orders:2,paidOrders:1,unpaidOrders:1,collectedRevenueCents:10000,refundsCents:2500,netRevenueCents:7500,newLeads:1});
    expect(report.website).toMatchObject({visitors:1,pageViews:2});
    expect(report.commerce.topProducts[0]).toMatchObject({productId:'p1',quantity:2,revenueCents:7500});
    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{businessId:'merchant-a'}}));
    expect(scoped).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({businessId:'merchant-a'})}));
  });
  it('stores hashed session identities and idempotent events without user details',async()=>{
    const business={id:'merchant-a',settings:{businessCatalog:{analyticsEnabled:true}},website:{published:{}}};
    const createMany:any=jest.fn(async(_args:any)=>({count:1}));
    const db:any={business:{findUnique:jest.fn(async()=>business)},businessRecord:{createMany}};
    const controller=new AnalyticsController(db);
    await controller.track({data:{storeUrl:'atelier',type:'page_view',eventId:'event-id-0123456789',sessionId:'session-id-0123456789',visitorId:'visitor-id-0123456789',page:'/customer@example.com/1234567890',referrer:'https://example.test/page?secret=yes',userAgent:'iPhone Safari'}});
    const stored=createMany.mock.calls[0][0].data[0];
    expect(stored.data.visitorKey).not.toContain('session-id');
    expect(stored.data).not.toHaveProperty('userAgent');
    expect(stored.data).not.toHaveProperty('email');
    expect(stored.data.page).toBe('/:id/:id');
    expect(stored.data.source).toBe('example.test');
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });
});
