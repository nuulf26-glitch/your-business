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
