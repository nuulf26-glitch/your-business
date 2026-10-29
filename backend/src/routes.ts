import { Body, Controller, Get, Post, Put, Patch, Delete, Req, Res, UseGuards, BadRequestException, NotFoundException, ConflictException, Logger, ServiceUnavailableException, Headers } from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength, IsObject, IsOptional, IsIn } from 'class-validator';
import { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { Throttle } from '@nestjs/throttler';
import { DbService } from './database';
import { Prisma } from '@prisma/client';
import { SessionGuard, tokenHash } from './session';
import { MailService } from './mail';
import { publicWebsite, validateWebsite } from './website-policy';
import { applyAiWebsiteOperations } from './ai-website';
import { allocate, localParts } from './availability';

@Controller('health')
export class HealthController {
  constructor(private db: DbService) {}
  @Get()
  async readiness() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}

class Credentials {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(200) password!: string;
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsString() @MaxLength(120) businessName?: string;
}
class StoreInput { @IsString() @MaxLength(120) name!: string; @IsString() @MaxLength(100) slug!: string; @IsString() category!: string; @IsObject() settings!: object; }
class JsonInput { @IsObject() data!: Record<string, unknown>; }
class WebsiteInput { @IsObject() model!: Record<string, unknown>; }
class AiPromptInput { @IsString() @MinLength(8) @MaxLength(1200) prompt!: string; @IsOptional() @IsIn(['create','modify']) mode?:'create'|'modify'; @IsOptional() @IsObject() model?:Record<string,unknown>; }
class AiHelpInput { @IsString() @MinLength(1) @MaxLength(2000) message!: string; @IsOptional() @IsObject() context?: Record<string, unknown>; }
class TokenInput { @IsString() @MinLength(32) @MaxLength(200) token!: string; }
class ResetInput extends TokenInput { @IsString() @MinLength(12) @MaxLength(200) password!: string; }
class EmailInput { @IsEmail() email!: string; }
class PayPalCaptureInput { @IsString() @MaxLength(100) orderId!: string; }
class OrderStatusInput { @IsString() @MaxLength(30) status!: string; }
class CustomerStatusInput { @IsString() @MaxLength(30) status!: string; }
class IdInput { @IsString() @MaxLength(120) id!: string; }
async function requestAiResponse(payload:Record<string,unknown>,apiKey:string,feature:'AI help') {
  let response:globalThis.Response;
  try { response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify(payload)}); }
  catch(error){Logger.error(JSON.stringify({code:error instanceof Error?error.name:'unknown'}),feature);throw new ServiceUnavailableException('AI help timed out or could not be reached. Please check your connection and try again.');}
  const data=await response.json().catch(()=>({})) as any;
  if(!response.ok){
    const code=String(data.error?.code||'unknown'),param=String(data.error?.param||'');
    Logger.error(JSON.stringify({status:response.status,code,param,requestId:response.headers.get('x-request-id')}),feature);
    if(response.status===401)throw new ServiceUnavailableException('CYB AI connection needs attention. Please contact support.');
    if(response.status===429)throw new ServiceUnavailableException('CYB AI is temporarily busy or the provider API balance is unavailable. Please try again shortly.');
    throw new ServiceUnavailableException('CYB AI help is temporarily unavailable. Please try again.');
  }
  if(data.status==='incomplete')throw new ServiceUnavailableException('CYB AI response was interrupted. Please try again.');
  return data;
}
function aiResponseText(data:any){return String(data.output_text||data.output?.flatMap((item:any)=>item.content||[]).filter((item:any)=>item.type==='output_text').map((item:any)=>item.text||'').join('\n')||'').trim();}
// Keep the session cookie host-only on the API origin. A configured parent
// domain (for example getcyb.fit) causes browsers to reject it on Render's
// staging hostname and can also be unnecessary when the API is a subdomain.
const cookieOptions = (expires: Date) => {const sameSite=(process.env.COOKIE_SAME_SITE||'lax') as 'lax'|'strict'|'none';return {httpOnly:true,secure:process.env.NODE_ENV==='production'||sameSite==='none',sameSite,expires,path:'/'};};

@Controller('auth')
export class AuthController {
  private logger=new Logger(AuthController.name);
  constructor(private db: DbService, private mail:MailService) {}
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('signup') async signup(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where:{email} })) throw new ConflictException('Account already exists');
    const trialEndsAt = new Date(Date.now()+14*864e5);
    const businessName = dto.businessName?.trim() || '';
    const slugBase = businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'business';
    const user = await this.db.$transaction(async tx => {
      const created = await tx.user.create({ data:{ email, fullName:dto.fullName?.trim() || null, passwordHash:await argon2.hash(dto.password), role:'OWNER', emailVerifiedAt:new Date() } });
      await tx.subscription.create({data:{userId:created.id,trialEndsAt}});
      await tx.business.create({data:{ownerId:created.id,name:businessName,slug:`${slugBase}-${created.id.slice(-6)}`,website:{create:{}}}});
      return created;
    });
    const sessionToken=await this.issueSession(user.id,res);
    return { id:user.id, email:user.email, emailVerified:true, trialEndsAt:trialEndsAt.toISOString(), ...(process.env.AUTH_BEARER_ENABLED==='true'&&sessionToken?{accessToken:sessionToken}:{}) };
  }
  @Throttle({default:{limit:8,ttl:60_000}})
  @Post('login') async login(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const user = await this.db.user.findUnique({ where:{ email:dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash,dto.password))) throw new BadRequestException('Invalid email or password');
    const sessionToken=await this.issueSession(user.id,res); return { id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt,...(process.env.AUTH_BEARER_ENABLED==='true'?{accessToken:sessionToken}:{}) };
  }
  @Throttle({default:{limit:6,ttl:60_000}})
  @Post('verify-email') async verifyEmail(@Body() dto:TokenInput) {
    const token=await this.db.verificationToken.findUnique({where:{tokenHash:tokenHash(dto.token)}});
    if(!token||token.expiresAt<=new Date()) throw new BadRequestException('Verification link is invalid or expired');
    await this.db.$transaction([this.db.user.update({where:{id:token.userId},data:{emailVerifiedAt:new Date()}}),this.db.verificationToken.deleteMany({where:{userId:token.userId}})]);
    return {verified:true};
  }
  @Throttle({default:{limit:3,ttl:60_000}})
  @Post('resend-verification') async resendVerification(@Body() dto:EmailInput) {
    const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()}});
    if(user&&!user.emailVerifiedAt) await this.createEmailLink(user.id,user.email,'verify');
    return {ok:true};
  }
  @Throttle({default:{limit:3,ttl:60_000}})
  @Post('forgot-password') async forgotPassword(@Body() dto:EmailInput) {
    const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()}});
    if(user) { try { await this.createEmailLink(user.id,user.email,'reset'); } catch(error) { this.logger.error('Password reset email delivery failed'); } }
    return {ok:true,message:'If the account exists, a password reset link will be sent.'};
  }
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('reset-password') async resetPassword(@Body() dto:ResetInput) {
    const record=await this.db.passwordResetToken.findUnique({where:{tokenHash:tokenHash(dto.token)}});
    if(!record||record.expiresAt<=new Date()) throw new BadRequestException('Password reset link is invalid or expired');
    const passwordHash=await argon2.hash(dto.password);
    await this.db.$transaction([
      this.db.user.update({where:{id:record.userId},data:{passwordHash}}),
      this.db.passwordResetToken.deleteMany({where:{userId:record.userId}}),
      this.db.session.deleteMany({where:{userId:record.userId}}),
    ]);
    return {reset:true};
  }
  private async createEmailLink(userId:string,email:string,type:'verify'|'reset') {
    const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+(type==='verify'?24:1)*3600_000),hash=tokenHash(token);
    if(type==='verify') { await this.db.verificationToken.deleteMany({where:{userId}}); await this.db.verificationToken.create({data:{userId,tokenHash:hash,expiresAt}}); }
    else { await this.db.passwordResetToken.deleteMany({where:{userId}}); await this.db.passwordResetToken.create({data:{userId,tokenHash:hash,expiresAt}}); }
    await this.mail.sendAccountLink(email,token,type);
  }
  private async issueSession(userId:string,res:Response) {
    const token=randomBytes(32).toString('base64url'), expires=new Date(Date.now()+14*864e5);
    await this.db.session.create({ data:{ userId, tokenHash:tokenHash(token), expiresAt:expires } }); res.cookie('getcyb_session',token,cookieOptions(expires)); return token;
  }
  @UseGuards(SessionGuard) @Get('me') async me(@Req() req:Request & {user:any}) {
    const subscription=await this.db.subscription.findUnique({where:{userId:req.user.id}});
    const trialActive=subscription?.status==='TRIALING'&&subscription.trialEndsAt>new Date();
    return {
      id:req.user.id,
      email:req.user.email,
      emailVerified:!!req.user.emailVerifiedAt,
      role:req.user.role,
      paid:subscription?.status==='ACTIVE',
      trialActive,
      trialEndsAt:subscription?.trialEndsAt.toISOString()||null,
    };
  }
  @UseGuards(SessionGuard) @Post('logout') async logout(@Req() req:Request & {user:any;sessionToken?:string},@Res({passthrough:true}) res:Response) {
    const token=req.sessionToken; if(token) await this.db.session.deleteMany({where:{tokenHash:tokenHash(token)}}); res.clearCookie('getcyb_session',{...cookieOptions(new Date(0))}); return {ok:true};
  }
}

@Controller('businesses')
export class BusinessController {
  constructor(private db:DbService){}
  @UseGuards(SessionGuard) @Get('mine') async mine(@Req() req:Request & {user:any}) { return this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}}); }
  @UseGuards(SessionGuard) @Get('mine/catalog') async catalog(@Req() req:Request & {user:any}) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    const settings=(business?.settings||{}) as Record<string,unknown>;
    return settings.businessCatalog||settings.catalog||null;
  }
  @UseGuards(SessionGuard) @Put('mine/catalog') async saveCatalog(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    if(!business)throw new NotFoundException('Business not found');
    const catalog=dto.data as Record<string,any>;
    if(!['salon','restaurant','store','services','portfolio','general'].includes(String(catalog.businessCategory)))throw new BadRequestException('Choose a business category');
    try { new Intl.DateTimeFormat('en-US',{timeZone:String(catalog.timeZone)}); } catch { throw new BadRequestException('Choose a valid timezone'); }
    const settings={...(business.settings as Record<string,unknown>),businessCatalog:catalog};
    return this.db.business.update({where:{id:business.id},data:{settings:settings as any}});
  }
  @UseGuards(SessionGuard) @Get('mine/records') async records(@Req() req:Request & {user:any}) {
    const type=String(req.query.type||'');
    if(!['bookings','inquiries','notifications','pickupOrders'].includes(type))throw new BadRequestException('Invalid business record type');
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    if(!business)return [];
    const rows=await this.db.businessRecord.findMany({where:{businessId:business.id,type},orderBy:{createdAt:'desc'},take:300});
    return rows.map(row=>({...(row.data as Record<string,unknown>),id:row.id,type:row.type,status:row.status,read:row.read,createdAt:row.createdAt.toISOString()}));
  }
  @UseGuards(SessionGuard) @Get('mine/analytics') async analytics(@Req() req:Request & {user:any}) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)return {days:[],pages:[],sources:[]};
    const rows=await this.db.businessRecord.findMany({where:{businessId:business.id,type:{in:['bookings','inquiries','pickupOrders','pageViews']}},orderBy:{createdAt:'desc'},take:2000});
    const days=new Map<string,any>(),pages=new Map<string,number>(),sources=new Map<string,number>();for(const row of rows){const data=row.data as any,key=row.createdAt.toISOString().slice(0,10);const day=days.get(key)||{date:key,bookings:0,inquiries:0,orders:0,visits:0,pageViews:0};if(row.type==='bookings')day.bookings++;if(row.type==='inquiries')day.inquiries++;if(row.type==='pickupOrders')day.orders++;if(row.type==='pageViews'){day.pageViews++;if(data.uniqueVisit)day.visits++;pages.set(data.page,(pages.get(data.page)||0)+1);if(data.uniqueVisit)sources.set(data.source,(sources.get(data.source)||0)+1);}days.set(key,day);}
    return {days:[...days.values()].slice(0,30).sort((a,b)=>b.date.localeCompare(a.date)),pages:[...pages].map(([page,views])=>({page,views})).sort((a,b)=>b.views-a.views).slice(0,10),sources:[...sources].map(([source,visits])=>({source,visits})).sort((a,b)=>b.visits-a.visits).slice(0,10)};
  }
  @UseGuards(SessionGuard) @Get('mine/clients') async clients(@Req() req:Request & {user:any}) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)return [];
    const [bookings,notes]=await Promise.all([this.db.businessRecord.findMany({where:{businessId:business.id,type:'bookings'},orderBy:{createdAt:'desc'},take:300}),this.db.businessRecord.findMany({where:{businessId:business.id,type:'clientNotes'},take:500})]);
    const crypto=require('node:crypto'),noteMap=new Map(notes.map(note=>[(note.data as any).clientId,(note.data as any).note||''])),map=new Map<string,any>();
    for(const row of bookings){const data=row.data as any,email=String(data.email||'').toLowerCase();if(!email)continue;const id=crypto.createHash('sha256').update(email).digest('hex');const client=map.get(id)||{id,name:data.name||'',email,phone:data.phone||'',bookings:[],note:noteMap.get(id)||''};client.bookings.push({id:row.id,start:data.start,serviceName:data.serviceName||'Table reservation',status:row.status});map.set(id,client);}
    return [...map.values()];
  }
  @UseGuards(SessionGuard) @Put('mine/client-notes/:id') async saveClientNote(@Req() req:Request & {user:any},@Body() dto:JsonInput){const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)throw new NotFoundException('Business not found');const id=String(req.params['id']);if(!/^[a-f0-9]{64}$/.test(id))throw new BadRequestException('Invalid client');const note=String(dto.data.note||'').slice(0,5000);const prior=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'clientNotes',data:{path:['clientId'],equals:id}}});if(prior)return this.db.businessRecord.update({where:{id:prior.id},data:{data:{clientId:id,note} as any}});return this.db.businessRecord.create({data:{businessId:business.id,type:'clientNotes',data:{clientId:id,note} as any}});}
  @UseGuards(SessionGuard) @Patch('mine/records/:id/reschedule') async rescheduleBooking(@Req() req:Request & {user:any},@Body() dto:JsonInput){const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)throw new NotFoundException('Business not found');const row=await this.db.businessRecord.findFirst({where:{id:String(req.params['id']),businessId:business.id,type:'bookings',status:'confirmed'}});if(!row)throw new NotFoundException('Confirmed booking not found');const start=String(dto.data.start||''),startMs=Date.parse(start),catalog=(business.settings as any).businessCatalog;if(!Number.isFinite(startMs)||startMs<Date.now())throw new BadRequestException('Choose a future time');if(!catalog)throw new BadRequestException('Booking availability is not configured');return this.db.$transaction(async tx=>{const date=localParts(startMs,catalog.timeZone||'UTC').date;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${business.id}), hashtext(${date}))`;const rows=await tx.businessRecord.findMany({where:{businessId:business.id,type:'bookings'},take:1000});const current=row.data as any;let slot:any;try{slot=allocate(catalog,{kind:current.kind,start,serviceId:current.serviceId,staffId:current.staffId,guests:current.guests},rows.filter(item=>item.id!==row.id).map(item=>item.data));}catch(error){throw new BadRequestException(error instanceof Error?error.message:'This time is unavailable');}const data={...current,...slot,date:localParts(slot.start,catalog.timeZone||'UTC').date,start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString(),rescheduledAt:new Date().toISOString()};return tx.businessRecord.update({where:{id:row.id},data:{data:data as any}});});}
  @UseGuards(SessionGuard) @Post('mine/records/bookings') async createOwnerBooking(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    if(!business)throw new NotFoundException('Business not found');
    const data=dto.data as Record<string,unknown>;
    if(data.storeUrl&&data.storeUrl!==business.slug)throw new NotFoundException('Business not found');
    const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),start=String(data.start||'');
    if(!name||!/^\S+@\S+\.\S+$/.test(email)||!Number.isFinite(Date.parse(start)))throw new BadRequestException('Enter a customer, valid email, and booking time');
    const record=await this.db.businessRecord.create({data:{businessId:business.id,type:'bookings',status:'confirmed',data:{...data,name,email,start,kind:data.kind==='reservation'?'reservation':'appointment'} as any}});
    return {id:record.id,start,status:record.status};
  }
  @UseGuards(SessionGuard) @Patch('mine/records/:id') async updateRecord(@Req() req:Request & {user:any},@Body() dto:OrderStatusInput) {
    const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    if(!business)throw new NotFoundException('Business not found');
    const type=String(req.query.type||'');
    if(type==='notifications'){
      const result=await this.db.businessRecord.updateMany({where:{id:String(req.params['id']),businessId:business.id,type},data:{read:true}});
      if(!result.count)throw new NotFoundException('Notification not found');
      return {success:true};
    }
    const allowed=type==='bookings'?['confirmed','completed','cancelled']:type==='pickupOrders'?['new','accepted','preparing','ready','completed','cancelled']:[];
    if(!allowed.includes(dto.status))throw new BadRequestException('Invalid status');
    const result=await this.db.businessRecord.updateMany({where:{id:String(req.params['id']),businessId:business.id,type},data:{status:dto.status}});
    if(!result.count)throw new NotFoundException('Business record not found');
    return {success:true};
  }
  @UseGuards(SessionGuard) @Put('mine') async save(@Req() req:Request & {user:any},@Body() dto:StoreInput) {
    if(!/^[a-z0-9-]{1,100}$/.test(dto.slug)) throw new BadRequestException('Slug must use lowercase letters, numbers, and hyphens');
    const existing=await this.db.business.findUnique({where:{slug:dto.slug}}); if(existing&&existing.ownerId!==req.user.id) throw new ConflictException('Website address is already taken');
    const current=await this.db.business.findFirst({where:{ownerId:req.user.id}});
    if(current) return this.db.business.update({where:{id:current.id},data:{name:dto.name,slug:dto.slug,category:dto.category,settings:dto.settings}});
    return this.db.business.create({data:{ownerId:req.user.id,name:dto.name,slug:dto.slug,category:dto.category,settings:dto.settings,website:{create:{}}}});
  }
  @Get('public/:slug') async publicBusiness(@Req() req:Request) {
    const slug=String(req.params['slug']||'');
    const business=await this.db.business.findUnique({where:{slug},include:{website:true}});
    if(!business?.website?.published)throw new NotFoundException('Website not found');
    const settings=business.settings as Record<string,unknown>;
    const safeKeys=['storeName','businessName','description','storeDescription','logoUrl','coverImageUrl','themeColor','primaryColor','backgroundColor','textColor','template','cardStyle','businessCategory','currency','language'];
    const publicSettings=Object.fromEntries(safeKeys.filter(key=>typeof settings[key]==='string').map(key=>[key,settings[key]]));
    const catalog=settings.businessCatalog||settings.catalog;
    return {id:business.id,name:business.name,slug:business.slug,category:business.category,settings:{...publicSettings,...(catalog?{businessCatalog:catalog,catalog}: {})}};
  }
}

@Controller('public')
export class PublicBusinessController {
  constructor(private db:DbService){}
  private async business(slug:string){const b=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!b?.website?.published)throw new NotFoundException('Website not found');return b;}
  private slot(catalog:any,data:any,rows:any[]){try{const slot=allocate(catalog,data,rows);return {...slot,date:localParts(slot.start,catalog.timeZone||'UTC').date,start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString()};}catch(error){throw new BadRequestException(error instanceof Error?error.message:'This time is unavailable');}}
  @Post('bookings/options') async bookingOptions(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog)return [];const date=String(data.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new BadRequestException('Choose a date');const rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'bookings'},take:1000});const midnight=Date.parse(`${date}T00:00:00Z`),slots=[];for(let offset=-14*60;offset<38*60;offset+=15){const ms=midnight+offset*60000;if(localParts(ms,catalog.timeZone||'UTC').date!==date)continue;try{const slot=allocate(catalog,{...data,start:new Date(ms).toISOString()},rows.map(r=>r.data));slots.push({start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString()});}catch{}}return slots;}
  @Post('bookings') async createBooking(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog)throw new BadRequestException('Online booking is not configured');const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),startMs=Date.parse(String(data.start||''));if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Enter your name and a valid email');if(!Number.isFinite(startMs))throw new BadRequestException('Choose a valid date and time');return this.db.$transaction(async tx=>{const date=localParts(startMs,catalog.timeZone||'UTC').date;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${b.id}), hashtext(${date}))`;const rows=await tx.businessRecord.findMany({where:{businessId:b.id,type:'bookings'},take:1000});const slot=this.slot(catalog,data,rows.map(r=>r.data));const booking=await tx.businessRecord.create({data:{businessId:b.id,type:'bookings',status:'confirmed',data:{...slot,name,email,phone:String(data.phone||'').slice(0,40)} as any}});await tx.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:slot.kind,message:`New ${slot.kind}: ${name}`} as any}});return {id:booking.id,start:slot.start,end:slot.end,status:booking.status,timeZone:catalog.timeZone};});}
  @Post('inquiries') async inquiry(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),message=String(data.message||'').trim();if(!name||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Complete the required fields');const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'inquiries',status:'new',data:{name,email,message,formId:String(data.formId||'').slice(0,100)} as any}});await this.db.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:'inquiry',message:`New inquiry: ${name}`} as any}});return {id:row.id};}
  @Post('analytics/pageview') async pageview(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),settings=b.settings as any,catalog=settings.businessCatalog||settings.catalog;if(!catalog?.analyticsEnabled)return {recorded:false};const session=String(data.sessionId||'');if(!/^[a-zA-Z0-9-]{16,100}$/.test(session)||typeof data.page!=='string'||data.page.length>200)throw new BadRequestException('Invalid analytics event');const date=new Date().toISOString().slice(0,10),sessionKey=createHash('sha256').update(`${date}:${session}`).digest('hex'),page=String(data.page),source=(()=>{try{return new URL(String(data.referrer||'')).hostname.slice(0,150)||'direct';}catch{return 'direct';}})();const prior=await this.db.businessRecord.findFirst({where:{businessId:b.id,type:'pageViews',data:{path:['sessionKey'],equals:sessionKey}}});const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'pageViews',data:{sessionKey,date,page,source,uniqueVisit:!prior} as any}});return {recorded:!!row};}
  @Post('pickup-orders') async pickup(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog?.takeawayEnabled)throw new BadRequestException('Pickup orders are not enabled');const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase();if(!name||!String(data.phone||'').trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Add your name, email and phone');const itemRows=Array.isArray(data.items)?data.items:[],menu=Array.isArray(catalog.menu)?catalog.menu:[],items=itemRows.map((item:any)=>{const p=menu.find((x:any)=>x.id===item.id&&x.active!==false),qty=Number(item.quantity);if(!p||!Number.isInteger(qty)||qty<1||qty>99)throw new BadRequestException('Invalid menu item');return {id:p.id,name:p.name,quantity:qty,price:Number(p.price)||0};});if(!items.length)throw new BadRequestException('Choose at least one item');const total=items.reduce((sum:any,item:any)=>sum+Math.round(item.price*100)*item.quantity,0);const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'pickupOrders',status:'new',data:{name,email,phone:String(data.phone).slice(0,40),items,total,pickupAt:data.pickupAt,paymentStatus:'Pay at pickup'} as any}});await this.db.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:'pickup',message:`New pickup order: ${name}`} as any}});return {id:row.id,total,status:row.status};}
}

@Controller('products')
@UseGuards(SessionGuard)
export class ProductController {
  constructor(private db:DbService){}
  private async business(userId:string){const b=await this.db.business.findFirst({where:{ownerId:userId}});if(!b)throw new NotFoundException('Create a business first');return b;}
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.business(req.user.id);return this.db.product.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'}});}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req.user.id);const name=String(dto.data.name||'').trim();if(!name)throw new BadRequestException('Product name required');return this.db.product.create({data:{businessId:b.id,name,data:dto.data as any}});}
  @Put(':id') async update(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req.user.id);const id=String(req.params['id']);const prior=await this.db.product.findFirst({where:{id,businessId:b.id}});if(!prior)throw new NotFoundException('Product not found');const merged={...(prior.data as Record<string,unknown>),...dto.data};const name=String(merged.name||prior.name).trim();if(!name)throw new BadRequestException('Product name required');const result=await this.db.product.updateMany({where:{id,businessId:b.id},data:{name,data:merged as any}});if(!result.count)throw new NotFoundException('Product not found');return this.db.product.findUnique({where:{id}});}
  @Delete(':id') async remove(@Req() req:Request & {user:any}){const b=await this.business(req.user.id);const result=await this.db.product.deleteMany({where:{id:String(req.params['id']),businessId:b.id}});if(!result.count)throw new NotFoundException('Product not found');return {deleted:true};}
}

@Controller('public/products')
export class PublicProductController {
  constructor(private db:DbService){}
  @Get(':slug') async list(@Req() req:Request){
    const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!business?.website?.published)throw new NotFoundException('Website not found');
    const rows=await this.db.product.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:300});
    return rows.filter(row=>(row.data as any)?.status!=='hidden').map(row=>{
      const data=row.data as Record<string,unknown>;
      return {id:row.id,name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category,stock:data.stock,media:data.media,legacyId:data.id};
    });
  }
  @Get('item/:id') async one(@Req() req:Request){const id=String(req.params['id']||'');const row=await this.db.product.findUnique({where:{id},include:{business:{include:{website:true}}}});if(!row||!row.business.website?.published||(row.data as any)?.status==='hidden')throw new NotFoundException('Product not found');const data=row.data as Record<string,unknown>;return {id:row.id,name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category,stock:data.stock,media:data.media,legacyId:data.id};}
}

@Controller('customers')
@UseGuards(SessionGuard)
export class CustomerController {
  constructor(private db:DbService){}
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)return [];return this.db.customer.findMany({where:{businessId:b.id},orderBy:{id:'desc'}});}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business first');return this.db.customer.create({data:{businessId:b.id,data:dto.data as any}});}
  @Patch(':id/status') async updateStatus(@Req() req:Request & {user:any},@Body() dto:CustomerStatusInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const id=String(req.params['id']);const customer=await this.db.customer.findFirst({where:{id,businessId:b.id}});if(!customer)throw new NotFoundException('Customer not found');const data={...(customer.data as Record<string,unknown>),status:dto.status};return this.db.customer.update({where:{id},data:{data:data as any}});}
  @Delete(':id') async remove(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const result=await this.db.customer.deleteMany({where:{id:String(req.params['id']),businessId:b.id}});if(!result.count)throw new NotFoundException('Customer not found');return {deleted:true};}
}

@Controller('orders')
@UseGuards(SessionGuard)
export class OrderController {
  constructor(private db:DbService){}
  @Get() async list(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)return [];return this.db.order.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'},take:300});}
  @Get(':id') async one(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const row=await this.db.order.findFirst({where:{id:String(req.params['id']),businessId:b.id}});if(!row)throw new NotFoundException('Order not found');return {...(row.data as object),id:row.id,status:row.status,createdAt:row.createdAt};}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const data=dto.data as Record<string,any>;const amount=Number(data.total??data.amount);return this.db.order.create({data:{businessId:b.id,status:String(data.status||'pending'),amountCents:Number.isFinite(amount)?Math.round(amount*100):null,currency:String(data.currency||'USD'),data:data as any}});}
  @Patch(':id/status') async updateStatus(@Req() req:Request & {user:any},@Body() dto:OrderStatusInput){
    const valid=['new','pending','paid','processing','shipped','delivered','cancelled','refunded'];if(!valid.includes(dto.status.toLowerCase()))throw new BadRequestException('Invalid order status');
    const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');
    const id=String(req.params['id']);const result=await this.db.order.updateMany({where:{id,businessId:b.id},data:{status:dto.status.toLowerCase()}});if(!result.count)throw new NotFoundException('Order not found');
    return this.db.order.findUnique({where:{id}});
  }
  @Patch(':id') async updateDetails(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const id=String(req.params['id']);const row=await this.db.order.findFirst({where:{id,businessId:b.id}});if(!row)throw new NotFoundException('Order not found');const data={...(row.data as Record<string,unknown>),...dto.data};const result=await this.db.order.update({where:{id},data:{data:data as any}});return {...(result.data as object),id:result.id,status:result.status,createdAt:result.createdAt};}
  @Delete(':id') async remove(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const result=await this.db.order.deleteMany({where:{id:String(req.params['id']),businessId:b.id}});if(!result.count)throw new NotFoundException('Order not found');return {deleted:true};}
}

// Customer checkout is intentionally public. The order is attached to a published
// business by its public slug; private order reads remain owner-scoped above.
@Controller('public/orders')
export class PublicOrderController {
  constructor(private db:DbService){}
  @Post() async create(@Body() dto:JsonInput){const data=dto.data as Record<string,any>;const slug=String(data.storeUrl||'');const business=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!business?.website?.published)throw new NotFoundException('Store not found');const name=String(data.customerName||'').trim(),email=String(data.email||'').trim().toLowerCase();if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Enter a valid customer name and email');const cart=Array.isArray(data.items)?data.items:[];if(!cart.length||cart.length>100)throw new BadRequestException('Invalid order items');const products=await this.db.product.findMany({where:{businessId:business.id}});const items=cart.map(item=>{const product=products.find(p=>p.id===item.id),quantity=Number(item.quantity);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>99||(product.data as any)?.status==='hidden')throw new BadRequestException('A product in this order is unavailable');const p=product.data as any,price=Number(p.salePrice||p.sellingPrice||p.price||0);if(!Number.isFinite(price)||price<0)throw new BadRequestException('Invalid product price');return {...item,id:product.id,name:product.name,price,quantity};});const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0),shipping=subtotal>=300?0:25,amount=subtotal+shipping;const normalized={...data,items,subtotal,shipping,total:amount,currency:'USD',status:'New',paymentStatus:'Pending',createdAt:new Date().toISOString()};const order=await this.db.$transaction(async tx=>{const created=await tx.order.create({data:{businessId:business.id,status:'new',amountCents:Math.round(amount*100),currency:'USD',data:normalized as any}});const prior=await tx.customer.findFirst({where:{businessId:business.id,data:{path:['email'],equals:email}}});const customerData={name,email,phone:String(data.phone||''),storeUrl:slug,status:'Active',lastOrder:new Date().toISOString(),orders:Number((prior?.data as any)?.orders||0)+1,totalSpent:Number((prior?.data as any)?.totalSpent||0)+amount};if(prior)await tx.customer.update({where:{id:prior.id},data:{data:customerData as any}});else await tx.customer.create({data:{businessId:business.id,data:customerData as any}});return created;});return {...(order.data as object),id:order.id,status:order.status,createdAt:order.createdAt};}
  @Post(':id/cash-on-delivery') async setCashOnDelivery(@Req() req:Request,@Body() dto:JsonInput){const id=String(req.params['id']);const row=await this.db.order.findUnique({where:{id}});if(!row||row.status!=='new')throw new NotFoundException('Order not found');const data={...(row.data as Record<string,unknown>),...(dto.data||{}),paymentMethod:'cash',paymentStatus:'Cash on delivery'};await this.db.order.update({where:{id},data:{data:data as any}});return {ok:true};}
}

@Controller('websites')
export class WebsiteController {
  constructor(private db:DbService){}
  private async businessFor(req:Request & {user:any}){const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)throw new NotFoundException('Create a business first');return business;}
  @UseGuards(SessionGuard) @Get('ai/status') async aiStatus(){return {available:Boolean(process.env.OPENAI_API_KEY?.trim()),usageLimited:false};}
  @UseGuards(SessionGuard) @Post('ai/design') async aiDesign(@Req() req:Request & {user:any},@Body() dto:AiPromptInput){
    const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('AI design is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');
    const modelName=process.env.OPENAI_MODEL||'gpt-4o-mini';
    const isModify=dto.mode==='modify';
    const currentModel=isModify?validateWebsite(dto.model,false):null;
    const instructions=isModify
      ? 'Edit the existing CYB website through a small set of structured operations. Return JSON only: {operations:[...]} . Allowed operations: {type:"site_style",fields:{brandName?,tagline?,description?,primaryColor?,backgroundColor?,textColor?,bodyFont?,headingFont?,buttonRadius?}}; {type:"update_section",pageId?,sectionId,fields:{title?,body?,buttonText?,eyebrow?,href?,variant?,limit?,style?:{fontFamily?,fontSize?,color?,backgroundColor?,textAlign?,paddingY?,letterSpacing?,lineHeight?,maxWidth?,minHeight?,hidden?},responsive?:{laptop?:style,ipad?:style,phone?:style}}}; {type:"add_section",pageId?,afterSectionId?,section:{type,label,title,body,buttonText?,eyebrow?,href?,variant?,limit?,items?}}. Add sections may use hero, about, services, gallery, collection, faq, reviews, contact, footer, heading, text, button, photo, divider, or spacer. A collection section renders real products already in the store; use limit:6 when asked for six products and never invent product records. For a mobile-friendly request, use responsive.phone and responsive.ipad overrides on relevant sections (smaller fontSize, reasonable paddingY and maxWidth; do not set fixed minHeight). {type:"move_section",pageId?,sectionId,beforeSectionId}; {type:"delete_section",pageId?,sectionId}. Use exact existing pageId and sectionId values from the website JSON. Do not replace the model or remove any content unless the user explicitly asks for deletion. Do not invent customer reviews, products, prices, metrics, or image URLs. For a request for reviews, add a section with clear editable placeholders requesting real customer quotes. For a visual or copy change, update only the relevant site or section fields. Return a short summary in an optional summary string. If the request cannot be mapped safely, return {operations:[]}.'
      : 'Create a complete, polished ecommerce or service-business website for CYB. Return JSON only with {brandName,primaryColor,backgroundColor,textColor,bodyFont,headingFont,buttonRadius,sections}. sections is an array of 4 to 10 objects with unique id, type, label, title, body and optional buttonText/items. Use only types hero, about, services, collection, gallery, faq, reviews, contact, footer. Include one hero and one footer, plus the relevant sections for this business such as about, product collection, gallery, FAQ, and contact. The website renderer adds an editable navigation header from the page list. Keep copy specific to the business. For unknown details, use clearly marked editable placeholders such as [Add your ingredients] instead of making claims. Never invent products, prices, customer reviews, ratings, or image URLs. If reviews are requested, create a reviews section with an editable placeholder for genuine customer quotes. Use collection for products that already exist in the store; otherwise say products will appear after they are added. Colors must be 6-digit hex.';
    let response:globalThis.Response;
    try { response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),body:JSON.stringify({model:modelName,max_output_tokens:isModify?1800:2500,instructions,input:isModify?`Existing editable website JSON:\n${JSON.stringify(currentModel)}\n\nUser request:\n${dto.prompt}\n\nReturn JSON operations only. Do not repeat the existing website.`:`Return a JSON object for this website design request: ${dto.prompt}`,text:{format:{type:'json_object'}}})}); }
    catch(error){Logger.error(JSON.stringify({code:error instanceof Error?error.name:'unknown'}),'AiDesign');throw new ServiceUnavailableException('AI design timed out or could not be reached. Your current website was not changed. Please try again.');}
    const data=await response.json().catch(()=>null) as any;if(!data||typeof data!=='object'||Array.isArray(data)){Logger.error(JSON.stringify({status:response.status,requestId:response.headers?.get('x-request-id')}),'AiDesign');throw new ServiceUnavailableException('AI returned an unreadable response. Your current website was not changed. Please try again.');}if(!response.ok){
      const code=String(data.error?.code||'unknown'),param=String(data.error?.param||'');
      Logger.error(JSON.stringify({status:response.status,code,param,requestId:response.headers?.get('x-request-id')}),'AiDesign');
      const message=response.status===401?'AI connection needs attention. Please contact support.':response.status===429?'AI is temporarily busy or its API balance is unavailable. Please try again shortly.':response.status===400?'AI design request was rejected. Please contact support with code AI_DESIGN_REQUEST.':'AI design service is temporarily unavailable. Please try again.';
      throw new ServiceUnavailableException(message);
    }
    if(data.status==='incomplete')throw new ServiceUnavailableException('The design was interrupted. Please try again with a shorter description.');
    const output=String(data.output_text||data.output?.flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text||'');let generated:any;try{generated=JSON.parse(output);}catch{throw new ServiceUnavailableException('AI returned an invalid design. Please try again.');}
    if(isModify){
      if(!currentModel)throw new BadRequestException('Choose a website to edit first.');
      try{return applyAiWebsiteOperations(currentModel,generated,dto.prompt);}catch(error){if(error instanceof BadRequestException)throw error;throw new ServiceUnavailableException('AI returned an edit that could not be safely applied. Your current website was not changed. Please try a more specific request.');}
    }
    const sections=Array.isArray(generated.sections)?generated.sections:[];const generatedSectionTypes=new Set(['hero','about','services','collection','gallery','faq','reviews','contact','footer']);if(sections.length<4||sections.length>10||!sections.some((section:any)=>section.type==='hero')||!sections.some((section:any)=>section.type==='footer')||sections.some((section:any)=>!generatedSectionTypes.has(section?.type)))throw new ServiceUnavailableException('AI returned an incomplete design. Please try again.');
    for(const section of sections)if(section.type==='reviews')section.items=[{name:'Customer name',quote:'Add a real customer review here.'}];
    const draft=validateWebsite({editorVersion:2,...generated,pages:[{id:'home',slug:'',title:'Home',sections:sections.map((section:any,index:number)=>({...section,id:`ai-${Date.now()}-${index}`,style:{fontFamily:section.type==='hero'?'Georgia':'Arial',fontSize:section.type==='hero'?56:28,color:generated.textColor||'#171513'}}))}]},true);
    return {model:draft};
  }
  @UseGuards(SessionGuard) @Post('ai/help') async aiHelp(@Req() req:Request & {user:any},@Body() dto:AiHelpInput){const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('CYB AI help is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');const context=JSON.stringify(dto.context||{}).slice(0,4000);const data=await requestAiResponse({model:process.env.OPENAI_MODEL||'gpt-4o-mini',max_output_tokens:700,instructions:'You are the friendly CYB website-builder guide. Explain steps simply, help users understand the editor, and answer questions about designing their website. When users want design changes, direct them to the Edit my website tab, where their request will be applied as an editable change. Never claim to perform changes in this help chat. Keep the answer concise and do not invent features.',input:`Current website and recent conversation context: ${context}\nUser question: ${dto.message}`},apiKey,'AI help');const answer=aiResponseText(data);if(!answer)throw new ServiceUnavailableException('CYB AI returned an empty reply. Please try again.');return {answer};}
  @Post('public/ai/help') async publicAiHelp(@Body() dto:AiHelpInput){
    const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('CYB AI help is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');
    const context=JSON.stringify(dto.context||{}).slice(0,4000);
    const data=await requestAiResponse({model:process.env.OPENAI_MODEL||'gpt-4o-mini',max_output_tokens:700,instructions:'You are the friendly CYB guide for visitors who have not created an account yet. Answer concise questions about CYB, starting a website, and the general website-building process. Do not claim to see or change a visitor’s account or website. If a question needs account-specific details, tell them to sign in. If you are unsure about a CYB feature, say so instead of guessing.',input:`Visitor context: ${context}\nQuestion: ${dto.message}`},apiKey,'AI help');
    const answer=aiResponseText(data);if(!answer)throw new ServiceUnavailableException('CYB AI returned an empty reply. Please try again.');return {answer};
  }
  @UseGuards(SessionGuard) @Get('draft') async draft(@Req() req:Request & {user:any}) {const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});return b?.website||null;}
  @UseGuards(SessionGuard) @Put('draft') async saveDraft(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business first');const model=validateWebsite(dto.model,false);return this.db.website.upsert({where:{businessId:b.id},create:{businessId:b.id,draft:model as any},update:{draft:model as any,revision:{increment:1}}});}
  @UseGuards(SessionGuard) @Post('publish') async publish(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website draft not found');const model=validateWebsite(dto.model,true);return this.db.$transaction(async tx=>{const site=await tx.website.update({where:{id:b.website!.id},data:{draft:model as any,published:publicWebsite(model) as any,publishedAt:new Date(),revision:{increment:1}}});const version=await tx.websiteVersion.create({data:{websiteId:site.id,snapshot:site.draft as any}});return {published:true,revision:site.revision,slug:b.slug,versionId:version.id};});}
  @UseGuards(SessionGuard) @Post('unpublish') async unpublish(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');return this.db.website.updateMany({where:{businessId:b.id},data:{published:Prisma.DbNull,publishedAt:null}});}
  @UseGuards(SessionGuard) @Get('versions') async versions(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)return [];return (await this.db.websiteVersion.findMany({where:{websiteId:b.website.id},orderBy:{createdAt:'desc'},take:10})).map(({snapshot,createdAt,...version})=>({...version,model:snapshot,publishedAt:createdAt}));}
  @UseGuards(SessionGuard) @Post('restore/:id') async restore(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website not found');const version=await this.db.websiteVersion.findFirst({where:{id:String(req.params['id']),websiteId:b.website.id}});if(!version)throw new NotFoundException('Version not found');const model=validateWebsite(version.snapshot,false);return this.db.website.update({where:{businessId:b.id},data:{draft:model as any,revision:{increment:1}}});}
  @Get('public/:slug') async publicSite(@Req() req:Request){const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug}});if(!business)throw new NotFoundException('Website not found');const site=await this.db.website.findUnique({where:{businessId:business.id}});return {business:{name:business.name,slug:business.slug,category:business.category},website:site?.published||null,published:!!site?.published};}
}

@Controller('uploads')
export class UploadController {
  @UseGuards(SessionGuard)
  @Post() async upload(@Req() req:Request & {user:any},@Headers('content-type') contentType:string,@Req() request:Request,@Res() response:Response) {
    const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];
    if(!allowed.includes(contentType))throw new BadRequestException('Unsupported media type');
    const bytes=Buffer.isBuffer(request.body)?request.body:Buffer.alloc(0);
    if(bytes.length<1||bytes.length>5*1024*1024)throw new BadRequestException('Media files must be 5 MB or smaller');
    const key=`businesses/${req.user.id}/${randomBytes(18).toString('hex')}`;
    const store=getStore('getcyb-assets');
    const image=new ArrayBuffer(bytes.length);new Uint8Array(image).set(bytes);
    await store.set(key,image,{metadata:{owner:req.user.id,contentType}});
    return response.status(201).json({key,publicUrl:`/api/v1/uploads/${key}`});
  }
  @Get(['businesses/:owner/:name', ':owner/:name']) async read(@Req() req:Request,@Res() response:Response) {
    const owner=String(req.params['owner']||''),name=String(req.params['name']||'');
    if(!/^[a-zA-Z0-9_-]{1,120}$/.test(owner)||!/^[a-f0-9]{36}$/.test(name))throw new NotFoundException('Image not found');
    const key=`businesses/${owner}/${name}`,store=getStore('getcyb-assets');
    const metadata=await store.getMetadata(key);
    if(!metadata)throw new NotFoundException('Image not found');
    const image=await store.get(key,{type:'arrayBuffer'});
    response.setHeader('Content-Type',String(metadata.metadata.contentType||'application/octet-stream'));
    response.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return response.status(200).send(Buffer.from(image));
  }
}

@Controller('payments/paypal')
@UseGuards(SessionGuard)
export class PayPalController {
  constructor(private db:DbService){}
  private async accessToken(){
    const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;if(!id||!secret)throw new BadRequestException('PayPal is not configured');
    const base=process.env.PAYPAL_API_BASE||'https://api-m.sandbox.paypal.com';
    const response=await fetch(`${base}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
    const body=await response.json() as any;if(!response.ok||!body.access_token)throw new BadRequestException('PayPal authentication failed');return {token:body.access_token,base};
  }
  @Post('orders') async createOrder(@Req() req:Request & {user:any}){
    const {token,base}=await this.accessToken(),amount=process.env.PAYPAL_BASIC_AMOUNT||'246.00';
    if(!/^\d+\.\d{2}$/.test(amount))throw new BadRequestException('PayPal price configuration is invalid');
    const response=await fetch(`${base}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':`getcyb-${randomBytes(16).toString('hex')}`},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:req.user.id,custom_id:req.user.id,description:'GETCYB Basic lifetime access',amount:{currency_code:'USD',value:amount}}]})});
    const body=await response.json() as any;if(!response.ok||!body.id)throw new BadRequestException('Could not create PayPal order');
    await this.db.paymentReference.create({data:{provider:'paypal',providerOrderId:body.id,status:'PENDING',amountCents:Math.round(Number(amount)*100),currency:'USD',userId:req.user.id,metadata:{intent:'PLATFORM_ACCESS'}}});
    return {orderId:body.id};
  }
  @Post('capture') async capture(@Req() req:Request & {user:any},@Body() dto:PayPalCaptureInput){
    const payment=await this.db.paymentReference.findUnique({where:{providerOrderId:dto.orderId}});if(!payment||payment.userId!==req.user.id)throw new NotFoundException('PayPal order not found');
    if(payment.status==='COMPLETED')return {success:true,status:'COMPLETED',orderId:dto.orderId};
    if(payment.status!=='PENDING')throw new BadRequestException('PayPal order cannot be captured');
    const {token,base}=await this.accessToken();
    const response=await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(dto.orderId)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':`gcb-${payment.id}`}});
    const capture=await response.json() as any;if(!response.ok)throw new BadRequestException('Could not capture PayPal payment');
    const unit=capture.purchase_units?.[0],item=unit?.payments?.captures?.[0];
    const valid=capture.status==='COMPLETED'&&item?.status==='COMPLETED'&&unit?.reference_id===req.user.id&&item?.amount?.currency_code===payment.currency&&Math.round(Number(item?.amount?.value)*100)===payment.amountCents;
    if(!valid)throw new BadRequestException('PayPal payment verification failed');
    await this.db.$transaction([
      this.db.paymentReference.update({where:{id:payment.id},data:{status:'COMPLETED',providerCaptureId:item.id,metadata:{intent:'PLATFORM_ACCESS',paypalOrderId:capture.id}}}),
      this.db.subscription.upsert({where:{userId:req.user.id},create:{userId:req.user.id,plan:'BASIC',status:'ACTIVE',billingType:'ONE_TIME',trialEndsAt:new Date()},update:{status:'ACTIVE',billingType:'ONE_TIME'}}),
    ]);
    return {success:true,status:'COMPLETED',orderId:capture.id};
  }
}
