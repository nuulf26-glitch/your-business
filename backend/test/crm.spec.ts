import { CrmController } from '../src/crm';

describe('CRM merchant isolation and workflows',()=>{
  const req=(biz='biz_a')=>({user:{id:'owner_a'},get:()=>biz} as any);
  it('scopes lead reads and writes to the selected owned business',async()=>{
    const db:any={business:{findFirst:jest.fn(async({where}:any)=>where.ownerId==='owner_a'&&where.id==='biz_a'?{id:'biz_a'}:null)},businessRecord:{findMany:jest.fn(async({where}:any)=>where.businessId==='biz_a'?[{id:'lead_a',businessId:'biz_a',type:'crmLead',data:{name:'A'},status:'new'}]:[]),findFirst:jest.fn(async({where}:any)=>where.businessId==='biz_a'?{id:where.id,businessId:'biz_a',type:where.type,data:{name:'Lead',email:'lead@example.com'},status:'new'}:null),updateMany:jest.fn(async({where}:any)=>({count:where.businessId==='biz_a'?1:0})),create:jest.fn(async({data}:any)=>({id:'created',...data,updatedAt:new Date(),createdAt:new Date()}))}};
    const crm=new CrmController(db);expect(await crm.leads(req())).toHaveLength(1);await expect(crm.leads(req('biz_other'))).rejects.toThrow();
    await expect(crm.updateLead(req('biz_other'),'lead_a',{data:{status:'won'}})).rejects.toThrow();
  });
  it('rejects invalid lead status and invalid deal values',async()=>{
    const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'biz_a'})},businessRecord:{create:jest.fn()}};const crm=new CrmController(db);
    await expect(crm.createLead(req(),{data:{name:'Test',status:'admin'}})).rejects.toThrow();
    await expect(crm.createDeal(req(),{data:{title:'Test',amount:-1}})).rejects.toThrow();
    expect(db.businessRecord.create).not.toHaveBeenCalled();
  });
});

describe('CRM activity, reminders, exports and ownership',()=>{
 const request=(biz='biz_a')=>({user:{id:'owner_a'},get:()=>biz} as any);
 const ownedBusiness={findFirst:jest.fn(async({where}:any)=>where.ownerId==='owner_a'&&['biz_a','biz_b'].includes(where.id)?{id:where.id||'biz_a'}:null)};
 it('records lead creation and updates exactly when data changes',async()=>{
  const now=new Date('2026-11-21T00:00:00Z');const lead={id:'lead_1',businessId:'biz_a',type:'crmLead',status:'new',data:{name:'Ada',email:'ada@example.test',status:'new'},updatedAt:now};
  const record={create:jest.fn(async({data}:any)=>({id:'lead_1',...data})),findFirst:jest.fn(async({where}:any)=>where.type==='crmLead'?lead:null),updateMany:jest.fn(async()=>({count:1})),createMany:jest.fn(async()=>({count:1}))};
  const crm=new CrmController({business:ownedBusiness,businessRecord:record} as any);
  await crm.createLead(request(),{data:{name:'Ada',email:'ada@example.test'}});
  expect(record.createMany).toHaveBeenCalledWith(expect.objectContaining({data:[expect.objectContaining({type:'crmActivity',data:expect.objectContaining({kind:'lead_created'})})]}));
  await crm.updateLead(request(),'lead_1',{data:{status:'contacted'}});
  expect(record.createMany).toHaveBeenCalledTimes(2);
  expect(record.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:'lead_1',businessId:'biz_a',type:'crmLead'}}));
 });
 it('creates a single persistent due reminder and scopes dismissals to the selected merchant',async()=>{
  const task={id:'task_1',status:'open',data:{title:'Call customer',dueAt:'2026-01-01T00:00:00.000Z',priority:'urgent'}};
  const rows=[{id:'reminder_1',status:'unread',data:{title:'Call customer'}}];
  const record={findMany:jest.fn(async({where}:any)=>where.type==='crmTask'?[task]:rows),createMany:jest.fn(async()=>({count:1})),updateMany:jest.fn(async({where}:any)=>({count:where.businessId==='biz_a'?1:0}))};
  const crm=new CrmController({business:ownedBusiness,businessRecord:record} as any);
  expect(await crm.reminders(request())).toHaveLength(1);
  expect(record.createMany).toHaveBeenCalledTimes(1);
  await expect(crm.updateReminder(request('biz_b'),'reminder_1',{data:{status:'dismissed'}})).rejects.toThrow();
  expect(record.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:'reminder_1',businessId:'biz_b',type:'crmReminder'}}));
 });
 it('limits CSV rows to the merchant and applies search, tags, spend and repeat filters',async()=>{
  const customers=[{id:'c1',data:{name:'VIP Ada',email:'ada@example.test',tags:['vip']}},{id:'c2',data:{name:'Other',email:'other@example.test',tags:[]}}];
  const db:any={business:ownedBusiness,customer:{findMany:jest.fn(async()=>customers)},order:{findMany:jest.fn(async()=>[{businessId:'biz_a',data:{email:'ada@example.test',paymentStatus:'Paid',total:100,paymentHistory:[{type:'collected',amountCents:10000}],refundHistory:[{amountCents:2000}]}},{businessId:'biz_a',data:{email:'ada@example.test',paymentStatus:'Paid',total:100,paymentHistory:[{type:'collected',amountCents:10000}],refundHistory:[]}}])}};
  const crm=new CrmController(db);const response:any={setHeader:jest.fn(),send:jest.fn()};
  await crm.exportCustomers(request(),{search:'VIP',tag:'vip',minSpent:'80',repeat:'true',sort:'name'},response);
  expect(response.send).toHaveBeenCalledWith(expect.stringContaining('ada@example.test'));
  expect(response.send.mock.calls[0][0]).not.toContain('other@example.test');
 });
 it('records changed customer tags once and scopes the tag update to the owning merchant',async()=>{
  const customer={id:'customer_1',businessId:'biz_a',data:{name:'Ada',tags:['vip']},updatedAt:new Date('2026-11-20T12:00:00Z')};
  const db:any={business:ownedBusiness,customer:{findFirst:jest.fn(async({where}:any)=>where.businessId==='biz_a'?customer:null),updateMany:jest.fn(async({where,data}:any)=>{if(where.businessId!=='biz_a')return {count:0};customer.data=data.data;return {count:1};})},businessRecord:{createMany:jest.fn(async()=>({count:1}))}};
  const crm=new CrmController(db);
  await crm.updateCustomerTags(request(),'customer_1',{data:{tags:['vip','priority']}});
  expect(db.businessRecord.createMany).toHaveBeenCalledTimes(1);
  expect(db.businessRecord.createMany).toHaveBeenCalledWith(expect.objectContaining({data:[expect.objectContaining({businessId:'biz_a',type:'crmActivity',data:expect.objectContaining({customerId:'customer_1',kind:'customer_tags_changed'})})],skipDuplicates:true}));
  await crm.updateCustomerTags(request(),'customer_1',{data:{tags:['priority','vip']}});
  expect(db.businessRecord.createMany).toHaveBeenCalledTimes(1);
  await expect(crm.updateCustomerTags(request('biz_missing'),'customer_1',{data:{tags:['leak']}})).rejects.toThrow();
 });
});
