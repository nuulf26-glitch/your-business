import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';

const statuses = ['new', 'contacted', 'qualified', 'won', 'lost'];
const bounded = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
function money(order: any) {
  const d = order?.data || {};
  const collected = Array.isArray(d.paymentHistory) ? d.paymentHistory.filter((x:any)=>x?.type==='collected').reduce((n:number,x:any)=>n+(Number(x.amountCents)||0),0) : (['paid','refunded'].includes(String(d.paymentStatus).toLowerCase()) ? Number(d.collectedAmountCents ?? order.amountCents ?? Math.round(Number(d.total||0)*100)) : 0);
  const refunded = Array.isArray(d.refundHistory) ? d.refundHistory.reduce((n:number,x:any)=>n+(Number(x.amountCents)||0),0) : 0;
  return {collected, refunded, net: Math.max(0,collected-refunded)};
}

@Controller('crm')
@UseGuards(SessionGuard)
export class CrmController {
  constructor(private db: DbService) {}
  private async business(req: Request & {user:any}) {
    const selected=String(req.get('x-cyb-business-id')||'').trim();
    const b=await this.db.business.findFirst({where:{ownerId:req.user.id,...(selected?{id:selected}:{})}});
    if(!b) throw new NotFoundException('Business not found');
    return b;
  }
  private async record(businessId:string,type:string,id:string) {
    const row=await this.db.businessRecord.findFirst({where:{id,businessId,type}});
    if(!row) throw new NotFoundException('CRM record not found');
    return row;
  }
  @Get('leads') async leads(@Req() req:any,@Query('search') search='') {
    const b=await this.business(req), rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmLead'},orderBy:{updatedAt:'desc'},take:500});
    const q=bounded(search,120).toLowerCase(); return rows.filter(r=>JSON.stringify(r.data).toLowerCase().includes(q)).map(r=>({id:r.id,...r.data as object,status:r.status,updatedAt:r.updatedAt}));
  }
  @Post('leads') async createLead(@Req() req:any,@Body() body:any) {
    const b=await this.business(req), data=body?.data||{}, name=bounded(data.name,120), email=bounded(data.email,254).toLowerCase();
    if(!name) throw new BadRequestException('Lead name is required');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email');
    const status=bounded(data.status,20)||'new'; if(!statuses.includes(status)) throw new BadRequestException('Invalid lead status');
    const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'crmLead',status,data:{name,email,phone:bounded(data.phone,40),company:bounded(data.company,120),source:bounded(data.source,80),assignedTo:bounded(data.assignedTo,120),status,tags:Array.isArray(data.tags)?data.tags.slice(0,20).map((x:any)=>bounded(x,40)):[],createdAt:new Date().toISOString()}}});
    return {id:row.id,...row.data as object,status:row.status};
  }
  @Patch('leads/:id') async updateLead(@Req() req:any,@Param('id') id:string,@Body() body:any) {
    const b=await this.business(req), row=await this.record(b.id,'crmLead',id), old=row.data as any, patch=body?.data||{};
    const status=patch.status===undefined?row.status:bounded(patch.status,20); if(!statuses.includes(status)) throw new BadRequestException('Invalid lead status');
    const data={...old,...Object.fromEntries(['name','email','phone','company','source','assignedTo','notes'].filter(k=>patch[k]!==undefined).map(k=>[k,bounded(patch[k],k==='notes'?3000:254)])),status,...(status==='won'&&old.status!=='won'?{convertedAt:new Date().toISOString()}: {})};
    const result=await this.db.businessRecord.updateMany({where:{id,businessId:b.id,type:'crmLead'},data:{data,status}}); if(!result.count)throw new NotFoundException('Lead not found'); return {id,...data};
  }
  @Get('deals') async deals(@Req() req:any) {const b=await this.business(req),rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmDeal'},orderBy:{updatedAt:'desc'},take:500});return rows.map(r=>({id:r.id,...r.data as object,status:r.status}));}
  @Post('deals') async createDeal(@Req() req:any,@Body() body:any) {const b=await this.business(req),d=body?.data||{},title=bounded(d.title,160),amount=Number(d.amount);if(!title||!Number.isFinite(amount)||amount<0)throw new BadRequestException('Deal title and a valid amount are required');const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'crmDeal',status:'open',data:{title,amount,currency:bounded(d.currency,3)||'USD',stage:bounded(d.stage,80)||'Qualification',customerId:bounded(d.customerId,120),leadId:bounded(d.leadId,120),expectedCloseAt:bounded(d.expectedCloseAt,40)}}});return {id:row.id,...row.data as object,status:row.status};}
  @Patch('deals/:id') async updateDeal(@Req() req:any,@Param('id') id:string,@Body() body:any) {const b=await this.business(req),row=await this.record(b.id,'crmDeal',id),data={...(row.data as any),...(body?.data||{})};for(const k of ['title','stage','currency','expectedCloseAt'])if(data[k]!==undefined)data[k]=bounded(data[k],160);if(data.amount!==undefined&&(!Number.isFinite(Number(data.amount))||Number(data.amount)<0))throw new BadRequestException('Invalid deal amount');const status=bounded(data.status,20)||row.status;if(!['open','won','lost'].includes(status))throw new BadRequestException('Invalid deal status');const safe={...data};delete safe.status;await this.db.businessRecord.updateMany({where:{id,businessId:b.id,type:'crmDeal'},data:{data:safe,status}});return {id,...safe,status};}
  @Get('tasks') async tasks(@Req() req:any) {const b=await this.business(req),rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmTask'},orderBy:{createdAt:'desc'},take:500});return rows.map(r=>({id:r.id,...r.data as object,status:r.status,createdAt:r.createdAt}));}
  @Post('tasks') async createTask(@Req() req:any,@Body() body:any) {const b=await this.business(req),d=body?.data||{},title=bounded(d.title,200),dueAt=bounded(d.dueAt,40);if(!title||!dueAt||!Number.isFinite(Date.parse(dueAt)))throw new BadRequestException('Task title and valid due date are required');const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'crmTask',status:'open',data:{title,dueAt,customerId:bounded(d.customerId,120),leadId:bounded(d.leadId,120),assignedTo:bounded(d.assignedTo,120),notes:bounded(d.notes,2000)}}});return {id:row.id,...row.data as object,status:row.status};}
  @Get('analytics') async analytics(@Req() req:any) {const b=await this.business(req),[customers,orders,leads]=await Promise.all([this.db.customer.findMany({where:{businessId:b.id},take:5000}),this.db.order.findMany({where:{businessId:b.id},take:5000}),this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmLead'},take:5000})]);const spend=new Map<string,{orders:number,gross:number,refunds:number,net:number}>();for(const o of orders){const e=String((o.data as any)?.email||'').toLowerCase();if(!e)continue;const m=spend.get(e)||{orders:0,gross:0,refunds:0,net:0},v=money(o);m.orders+=v.collected>0?1:0;m.gross+=v.collected;m.refunds+=v.refunded;m.net+=v.net;spend.set(e,m);}const gross=[...spend.values()].reduce((n,x)=>n+x.gross,0),refunds=[...spend.values()].reduce((n,x)=>n+x.refunds,0);return {customers:customers.length,acquired:customers.length,repeatCustomers:[...spend.values()].filter(x=>x.orders>1).length,leads:leads.length,convertedLeads:leads.filter(x=>x.status==='won').length,conversionRate:leads.length?leads.filter(x=>x.status==='won').length/leads.length:0,grossCollectedCents:gross,refundsCents:refunds,netCustomerValueCents:Math.max(0,gross-refunds),averageNetCustomerValueCents:customers.length?Math.max(0,gross-refunds)/customers.length:0};}
}
