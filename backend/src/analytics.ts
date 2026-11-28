import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { DbService } from './database';
import { SessionGuard } from './session';

const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const number = (value:unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const eventTypes = new Set(['page_view','product_view','add_to_cart','checkout_start']);

export function collectedCents(order:any):number {
  const d=order?.data||{};
  const history=Array.isArray(d.paymentHistory)?d.paymentHistory.filter((x:any)=>x?.type==='collected'):[];
  if(history.length)return history.reduce((n:number,x:any)=>n+Math.max(0,number(x.amountCents)),0);
  if(!['paid','refunded'].includes(String(d.paymentStatus||'').toLowerCase()))return 0;
  return Math.max(0,number(d.collectedAmountCents??order.amountCents??Math.round(number(d.total)*100)));
}
export function refundedCents(order:any):number {
  const d=order?.data||{};
  if(Array.isArray(d.refundHistory))return d.refundHistory.reduce((n:number,x:any)=>n+Math.max(0,number(x?.amountCents)),0);
  return Math.max(0,number(d.refundedAmountCents));
}
function moneyEvents(order:any,kind:'collected'|'refund'):{amount:number;at:Date}[]{
  const d=order?.data||{},rows=kind==='collected'?d.paymentHistory?.filter((x:any)=>x?.type==='collected'):d.refundHistory;
  if(Array.isArray(rows)&&rows.length)return rows.map((x:any)=>({amount:Math.max(0,number(x.amountCents)),at:new Date(x.recordedAt||x.createdAt||order.createdAt)})).filter((x:any)=>Number.isFinite(x.at.getTime()));
  const amount=kind==='collected'?collectedCents(order):refundedCents(order);
  return amount>0?[{amount,at:new Date(order.createdAt)}]:[];
}
export function localDate(value:Date,timeZone:string):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
function periodKey(day:string,interval:string){if(interval==='yearly')return `${day.slice(0,4)}-01-01`;if(interval==='monthly')return `${day.slice(0,7)}-01`;if(interval==='weekly'){const date=new Date(`${day}T00:00:00Z`),weekday=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-weekday);return date.toISOString().slice(0,10);}return day;}
function validTimeZone(value:string){try{new Intl.DateTimeFormat('en-US',{timeZone:value});return value;}catch{throw new BadRequestException('Invalid reporting time zone');}}
function validateRange(from:string,to:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new BadRequestException('Use YYYY-MM-DD dates');
  const start=Date.parse(`${from}T00:00:00Z`),end=Date.parse(`${to}T00:00:00Z`);
  if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==from||new Date(end).toISOString().slice(0,10)!==to||start>end||end-start>366*86400000)throw new BadRequestException('Choose a valid date range up to 366 days');
}
function inRange(value:Date,from:string,to:string,tz:string){const day=localDate(value,tz);return day>=from&&day<=to;}
function parseData(row:any){return row?.data&&typeof row.data==='object'?row.data:{};}
function deviceFrom(ua:string){const v=ua.toLowerCase();return /ipad|tablet/.test(v)?'tablet':/mobile|iphone|android/.test(v)?'mobile':'desktop';}
function browserFrom(ua:string){return /edg\//i.test(ua)?'Edge':/firefox\//i.test(ua)?'Firefox':/chrome\//i.test(ua)?'Chrome':/safari\//i.test(ua)&&!/chrome\//i.test(ua)?'Safari':'Other';}
function sourceHost(value:string){try{const u=new URL(value);return u.protocol==='http:'||u.protocol==='https:'?u.hostname.slice(0,120):'direct';}catch{return 'direct';}}
function safePage(value:string){return value.split('/').map((part,index)=>index===0?'':(/^\d{2,}$/.test(part)||/^[0-9a-f-]{24,}$/i.test(part)||/^[^@\s]+@[^@\s]+$/.test(part)?':id':part.slice(0,50))).join('/').slice(0,200)||'/';}

@Controller('analytics')
export class AnalyticsController {
  constructor(private db:DbService){}
  private async business(req:Request & {user:any}){
    const id=String(req.get('x-cyb-business-id')||'').trim();
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id,...(id?{id}:{})}});
    if(!business)throw new NotFoundException('Business not found');
    return business;
  }
  @Post('event') async track(@Body() body:any){
    const data=body?.data||{},slug=String(data.storeUrl||'').slice(0,100);
    if(!/^[a-z0-9-]{1,100}$/.test(slug))throw new BadRequestException('Invalid website');
    const business=await this.db.business.findUnique({where:{slug},include:{website:true}});
    if(!business?.website?.published)throw new NotFoundException('Website not found');
    const settings=business.settings as any,catalog=settings?.businessCatalog||settings?.catalog;
    if(catalog?.analyticsEnabled!==true)return {recorded:false,reason:'analytics_disabled'};
    const type=String(data.type||'page_view'),eventId=String(data.eventId||'');
    if(!eventTypes.has(type)||!/^[a-zA-Z0-9_-]{16,100}$/.test(eventId))throw new BadRequestException('Invalid analytics event');
    const rawPage=String(data.page||'/').slice(0,200);
    if(!rawPage.startsWith('/')||rawPage.startsWith('//')||/[?#]/.test(rawPage))throw new BadRequestException('Invalid page path');
    const page=safePage(rawPage);
    const rawSession=String(data.sessionId||''),rawVisitor=String(data.visitorId||'');
    if(!/^[a-zA-Z0-9_-]{16,100}$/.test(rawSession)||!/^[a-zA-Z0-9_-]{16,100}$/.test(rawVisitor))throw new BadRequestException('Invalid analytics identity');
    const visitorKey=hash(`${business.id}:${rawVisitor}`),sessionKey=hash(`${business.id}:${rawSession}`);
    const id=`web_evt_${hash(`${business.id}:${eventId}`).slice(0,48)}`;
    const referrer=sourceHost(String(data.referrer||''));
    const ua=String(data.userAgent||'').slice(0,500);
    await this.db.businessRecord.createMany({data:[{id,businessId:business.id,type:'analyticsEvent',data:{type,page,visitorKey,sessionKey,source:referrer,device:deviceFrom(ua),browser:browserFrom(ua)}}],skipDuplicates:true});
    return {recorded:true};
  }
  @UseGuards(SessionGuard) @Get('overview') async overview(@Req() req:Request & {user:any},@Query() query:any){
    const b=await this.business(req),settings=b.settings as any,tz=validTimeZone(String(query.timeZone||settings?.businessCatalog?.timeZone||settings?.catalog?.timeZone||'UTC')),interval=String(query.interval||'daily');
    if(!['daily','weekly','monthly','yearly'].includes(interval))throw new BadRequestException('Invalid reporting interval');
    const to=String(query.to||localDate(new Date(),tz)),from=String(query.from||new Date(Date.now()-29*86400000).toISOString().slice(0,10));validateRange(from,to);
    const span=Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`)+86400000;
    const priorTo=new Date(Date.parse(`${from}T00:00:00Z`)-86400000).toISOString().slice(0,10),priorFrom=new Date(Date.parse(`${priorTo}T00:00:00Z`)-span+86400000).toISOString().slice(0,10);
    const [orders,customers,leads,deals,tasks,events,legacyViews,conversions]=await Promise.all([
      this.db.order.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'},take:10000}),
      this.db.customer.findMany({where:{businessId:b.id},take:10000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmLead'},take:5000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmDeal'},take:5000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:'crmTask'},take:5000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:'analyticsEvent'},orderBy:{createdAt:'desc'},take:20000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:'pageViews'},orderBy:{createdAt:'desc'},take:20000}),
      this.db.businessRecord.findMany({where:{businessId:b.id,type:{in:['bookings','inquiries','pickupOrders']}},orderBy:{createdAt:'desc'},take:10000}),
    ]);
    const inPeriod=(r:any,a:string,z:string)=>inRange(r.createdAt,a,z,tz);
    const windowRows=(rows:any[],a:string,z:string)=>rows.filter(r=>inPeriod(r,a,z));
    const summarize=(a:string,z:string)=>{
      const os=windowRows(orders,a,z),cs=windowRows(customers,a,z),ls=windowRows(leads,a,z),ds=windowRows(deals,a,z),ts=windowRows(tasks,a,z);
      const collectedEvents=orders.flatMap((o:any)=>moneyEvents(o,'collected').filter(x=>inRange(x.at,a,z,tz)).map(x=>({...x,orderId:o.id}))),refundEvents=orders.flatMap((o:any)=>moneyEvents(o,'refund').filter(x=>inRange(x.at,a,z,tz)));
      const collected=collectedEvents.reduce((n:number,x:any)=>n+x.amount,0),refunds=refundEvents.reduce((n:number,x:any)=>n+x.amount,0);
      const converted=ls.filter((x:any)=>String(x.status).toLowerCase()==='won').length;
      const won=ds.filter((x:any)=>String(parseData(x).status).toLowerCase()==='won').length;
      const closed=ds.filter((x:any)=>['won','lost'].includes(String(parseData(x).status).toLowerCase()));
      const paidOrders=os.filter((o:any)=>collectedCents(o)>0).length;
      const unpaidOrders=os.filter((o:any)=>{
        const status=String(o.status||parseData(o).status||'').toLowerCase();
        return collectedCents(o)<=0&&!['cancelled','canceled'].includes(status);
      }).length;
      return {orders:os.length,paidOrders,unpaidOrders,collectedRevenueCents:collected,refundsCents:refunds,netRevenueCents:collected-refunds,averageOrderValueCents:paidOrders?Math.round(collected/paidOrders):0,newCustomers:cs.length,newLeads:ls.length,leadConversionRate:ls.length?converted/ls.length:0,openPipelineValueCents:ds.filter((x:any)=>!['won','lost'].includes(String(parseData(x).status).toLowerCase())).reduce((n:number,x:any)=>n+Math.round(number(parseData(x).amount)*100),0),dealWinRate:closed.length?won/closed.length:0,completedTasks:ts.filter((x:any)=>String(x.status).toLowerCase()==='completed').length,tasks:ts.length};
    };
    const current=summarize(from,to),previous=summarize(priorFrom,priorTo),currency=String(windowRows(orders,from,to)[0]?.currency||settings?.commerceSettings?.currency||settings?.currency||'AED').toUpperCase();
    let webRows=windowRows(events,from,to).map(r=>({createdAt:r.createdAt,data:parseData(r)}));
    if(!events.length)webRows=windowRows(legacyViews,from,to).map(r=>({createdAt:r.createdAt,data:{type:'page_view',page:parseData(r).page,visitorKey:parseData(r).sessionKey,source:parseData(r).source,device:'unknown',browser:'unknown'}}));
    const pageRows=webRows.filter(x=>x.data.type==='page_view');
    const visitors=new Set(pageRows.map(x=>x.data.visitorKey).filter(Boolean)), sessions=new Set(pageRows.map(x=>x.data.sessionKey||x.data.visitorKey).filter(Boolean));
    const pages=new Map<string,number>(),sourceSessions=new Map<string,Set<string>>(),deviceSessions=new Map<string,Set<string>>(),browserSessions=new Map<string,Set<string>>(),attributedSessions=new Set<string>(),daily=new Map<string,any>();
    for(const row of [...pageRows].sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime())){const d=row.data,day=periodKey(localDate(row.createdAt,tz),interval),key=String(d.page||'/'),session=String(d.sessionKey||d.visitorKey||row.createdAt.toISOString());pages.set(key,(pages.get(key)||0)+1);const source=String(d.source||'direct');if(!attributedSessions.has(session)){const sourceSet=sourceSessions.get(source)||new Set<string>();sourceSet.add(session);sourceSessions.set(source,sourceSet);attributedSessions.add(session);}const device=String(d.device||'unknown'),deviceSet=deviceSessions.get(device)||new Set<string>();deviceSet.add(session);deviceSessions.set(device,deviceSet);const browser=String(d.browser||'unknown'),browserSet=browserSessions.get(browser)||new Set<string>();browserSet.add(session);browserSessions.set(browser,browserSet);const v=daily.get(day)||{date:day,pageViews:0,uniqueVisitors:0,revenue:0,orders:0,visitorKeys:new Set<string>()};v.pageViews++;if(d.visitorKey)v.visitorKeys.add(String(d.visitorKey));daily.set(day,v);}
    const currentOrders=windowRows(orders,from,to);
    for(const order of currentOrders){const day=periodKey(localDate(order.createdAt,tz),interval),row=daily.get(day)||{date:day,pageViews:0,uniqueVisitors:0,revenue:0,orders:0,visitorKeys:new Set<string>()};row.orders++;daily.set(day,row);}
    for(const order of orders)for(const kind of ['collected','refund'] as const)for(const event of moneyEvents(order,kind)){if(!inRange(event.at,from,to,tz))continue;const key=periodKey(localDate(event.at,tz),interval),row=daily.get(key)||{date:key,pageViews:0,uniqueVisitors:0,revenue:0,orders:0,visitorKeys:new Set<string>()};row.revenue+=(kind==='collected'?event.amount:-event.amount)/100;daily.set(key,row);}
    for(const row of daily.values()){row.uniqueVisitors=row.visitorKeys.size;delete row.visitorKeys;}
    const uniqueViews=legacyViews.filter(r=>inPeriod(r,from,to)&&(parseData(r).uniqueVisit===true)).length;
    const uniqueVisitors=events.length?visitors.size:uniqueViews;
    const sessionPages=new Map<string,{first:{page:string;at:Date};last:{page:string;at:Date}}>();for(const row of pageRows){const key=String(row.data.sessionKey||row.data.visitorKey||'');if(!key)continue;const page=String(row.data.page||'/'),at=new Date(row.createdAt),seen=sessionPages.get(key);if(!seen)sessionPages.set(key,{first:{page,at},last:{page,at}});else{if(at<seen.first.at)seen.first={page,at};if(at>seen.last.at)seen.last={page,at};}}const landing=new Map<string,number>(),exits=new Map<string,number>();for(const session of sessionPages.values()){landing.set(session.first.page,(landing.get(session.first.page)||0)+1);exits.set(session.last.page,(exits.get(session.last.page)||0)+1);}
    const conversionRows=windowRows(conversions,from,to).filter(r=>!['cancelled','canceled'].includes(String(r.status||'').toLowerCase())).length;
    const paidOrderIds=new Set(orders.filter((order:any)=>moneyEvents(order,'collected').some(e=>inRange(e.at,from,to,tz))).map((order:any)=>order.id));
    const conversionEvents=conversionRows+paidOrderIds.size;
    const previousRaw=events.length?windowRows(events,priorFrom,priorTo).map(r=>({createdAt:r.createdAt,data:parseData(r)})):windowRows(legacyViews,priorFrom,priorTo).map(r=>({createdAt:r.createdAt,data:{type:'page_view',visitorKey:parseData(r).sessionKey}}));
    const previousWebsite={visitors:new Set(previousRaw.map(x=>x.data.visitorKey).filter(Boolean)).size,sessions:new Set(previousRaw.map(x=>x.data.sessionKey||x.data.visitorKey).filter(Boolean)).size,pageViews:previousRaw.filter(x=>x.data.type==='page_view').length,conversionEvents:windowRows(conversions,priorFrom,priorTo).filter(r=>!['cancelled','canceled'].includes(String(r.status||'').toLowerCase())).length+new Set(orders.filter((order:any)=>moneyEvents(order,'collected').some(e=>inRange(e.at,priorFrom,priorTo,tz))).map((order:any)=>order.id)).size};
    const best=new Map<string,any>();for(const order of currentOrders){const gross=collectedCents(order),net=Math.max(0,gross-refundedCents(order));if(net<=0||['cancelled','canceled','returned'].includes(String(order.status||parseData(order).fulfillmentStatus||'').toLowerCase()))continue;for(const item of (parseData(order).items||[])){const id=String(item.productId||item.id||'unknown'),x=best.get(id)||{productId:id,name:String(item.name||'Product'),quantity:0,revenueCents:0,variants:[]};x.quantity+=Math.max(0,number(item.quantity));x.revenueCents+=Math.round(Math.max(0,number(item.price)*number(item.quantity))*100*(gross?net/gross:0));if(item.variantId||item.variantName){const variantId=String(item.variantId||item.variantName),variant=x.variants.find((v:any)=>v.id===variantId);if(variant){variant.quantity+=Math.max(0,number(item.quantity));variant.revenueCents+=Math.round(Math.max(0,number(item.price)*number(item.quantity))*100*(gross?net/gross:0));}else x.variants.push({id:variantId,name:String(item.variantName||variantId),quantity:Math.max(0,number(item.quantity)),revenueCents:Math.round(Math.max(0,number(item.price)*number(item.quantity))*100*(gross?net/gross:0))});}best.set(id,x);}}
    const crmEmails=new Map<string,{orders:number;net:number}>();for(const o of orders){const email=String(parseData(o).email||'').trim().toLowerCase(),net=collectedCents(o)-refundedCents(o);if(!email||net<=0||['cancelled','canceled','returned'].includes(String(o.status||parseData(o).fulfillmentStatus||'').toLowerCase()))continue;const x=crmEmails.get(email)||{orders:0,net:0};x.orders++;x.net+=net;crmEmails.set(email,x);}
    const periodCustomers=windowRows(customers,from,to).length;
    const customerLifetimeValueCents=crmEmails.size?Math.round([...crmEmails.values()].reduce((n,x)=>n+x.net,0)/crmEmails.size):0;
    return {range:{from,to,previousFrom:priorFrom,previousTo:priorTo,timeZone:tz,interval},currency,current,previous,previousWebsite,website:{visitors:uniqueVisitors,sessions:sessions.size||uniqueVisitors,pageViews:webRows.filter(x=>x.data.type==='page_view').length,conversionEvents,conversionRate:uniqueVisitors?conversionEvents/uniqueVisitors:0,productViews:webRows.filter(x=>x.data.type==='product_view').length,addToCart:webRows.filter(x=>x.data.type==='add_to_cart').length,checkoutStarts:webRows.filter(x=>x.data.type==='checkout_start').length,pages:[...pages].map(([page,views])=>({page,views})).sort((x,y)=>y.views-x.views).slice(0,10),landingPages:[...landing].map(([page,visits])=>({page,visits})).sort((x,y)=>y.visits-x.visits).slice(0,10),exitPages:[...exits].map(([page,visits])=>({page,visits})).sort((x,y)=>y.visits-x.visits).slice(0,10),sources:[...sourceSessions].map(([source,visits])=>({source,visits:visits.size})).sort((x,y)=>y.visits-x.visits).slice(0,10),devices:[...deviceSessions].map(([device,visits])=>({device,visits:visits.size})),browsers:[...browserSessions].map(([browser,visits])=>({browser,visits:visits.size}))},commerce:{...current,averageOrderValueCents:current.averageOrderValueCents,topProducts:[...best.values()].sort((x,y)=>y.quantity-x.quantity).slice(0,10),salesByChannel:[...new Set(currentOrders.map((o:any)=>String(parseData(o).salesChannel||parseData(o).channel||'storefront')))].map(channel=>({channel,orders:currentOrders.filter((o:any)=>String(parseData(o).salesChannel||parseData(o).channel||'storefront')===channel).length})),repeatCustomers:[...crmEmails.values()].filter(x=>x.orders>1).length,totalPayingCustomers:crmEmails.size,repeatPurchaseRate:crmEmails.size?[...crmEmails.values()].filter(x=>x.orders>1).length/crmEmails.size:0,customerLifetimeValueCents},crm:{newCustomers:periodCustomers,newLeads:current.newLeads,leadConversionRate:current.leadConversionRate,openPipelineValueCents:current.openPipelineValueCents,dealWinRate:current.dealWinRate,completedTasks:current.completedTasks,tasks:current.tasks},trend:[...daily.values()].sort((x,y)=>x.date.localeCompare(y.date))};
  }
  @UseGuards(SessionGuard) @Get('reports') async reports(@Req() req:Request & {user:any}){const b=await this.business(req),rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'analyticsReport'},orderBy:{updatedAt:'desc'},take:100});return rows.map(r=>({id:r.id,...parseData(r)}));}
  @UseGuards(SessionGuard) @Post('reports') async saveReport(@Req() req:Request & {user:any},@Body() body:any){const b=await this.business(req),name=String(body?.data?.name||'').trim().slice(0,100),period=String(body?.data?.period||'custom'),from=String(body?.data?.from||''),to=String(body?.data?.to||'');if(!name||!['daily','weekly','monthly','yearly','custom'].includes(period))throw new BadRequestException('Provide a name and valid report period');if(from||to)validateRange(from,to);const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'analyticsReport',data:{name,period,from,to,createdAt:new Date().toISOString()}}});return {id:row.id,...parseData(row)};}
  @UseGuards(SessionGuard) @Delete('reports/:id') async deleteReport(@Req() req:Request & {user:any},@Param('id') id:string){const b=await this.business(req);const result=await this.db.businessRecord.deleteMany({where:{id,businessId:b.id,type:'analyticsReport'}});if(!result.count)throw new NotFoundException('Saved report not found');return {deleted:true};}
  @UseGuards(SessionGuard) @Get('export.csv') async exportCsv(@Req() req:Request & {user:any},@Query() query:any,@Res() res:Response){const result=await this.overview(req,query),rows=[['Metric','Value'],['From',result.range.from],['To',result.range.to],['Visitors',result.website.visitors],['Sessions',result.website.sessions],['Page views',result.website.pageViews],['Orders',result.current.orders],['Paid orders',result.current.paidOrders],[`Collected revenue ${result.currency}`,result.current.collectedRevenueCents/100],[`Refunds ${result.currency}`,result.current.refundsCents/100],[`Net revenue ${result.currency}`,result.current.netRevenueCents/100],['New customers',result.current.newCustomers],['New leads',result.current.newLeads],['Lead conversion rate',result.current.leadConversionRate],...result.trend.map((x:any)=>[x.date,x.pageViews,x.uniqueVisitors,x.orders,x.revenue])];const csv=rows.map(row=>row.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="cyb-analytics-report.csv"');return res.send(`\uFEFF${csv}`);}
}

export function analyticsTestHelpers(){return {deviceFrom,browserFrom,sourceHost,hash,collectedCents,refundedCents,localDate};}
