Warning: truncated output (original token count: 22232)
Total output lines: 752

import { Body, Controller, Get, Post, Put, Patch, Delete, Req, Res, UseGuards, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger, ServiceUnavailableException, Headers, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsNumber, IsString, MinLength, MaxLength, IsObject, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { MediaStorage, assertOwnedMedia } from './media-storage';
import { getStore } from '@netlify/blobs';
import { Throttle } from '@nestjs/throttler';
import { DbService } from './database';
import { Prisma } from '@prisma/client';
import { SessionGuard, tokenHash } from './session';
import { MailService } from './mail';
import { publicWebsite, publicationDifferencePaths, validateWebsite } from './website-policy';
import { applyAiWebsiteOperations, normalizeGeneratedWebsite } from './ai-website';
import { allocate, localParts } from './availability';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
function stagingDiagnosticsEnabled(){
  try { const app=new URL(process.env.PUBLIC_APP_URL||''); return app.protocol==='https:'&&app.hostname==='getcyb-staging-web.onrender.com'; }
  catch { return false; }
}

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
  @IsOptional() @IsBoolean() acceptedTerms?: boolean;
}
class LoginCredentials {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}
class GoogleSignInInput {
  @IsString() @MinLength(20) @MaxLength(10000) idToken!: string;
  @IsOptional() @IsBoolean() acceptedTerms?: boolean;
}
class LegacySessionInput {
  @IsString() @MinLength(32) @MaxLength(200) sessionToken!: string;
}
class StoreInput { @IsString() @MaxLength(120) name!: string; @IsString() @MaxLength(100) slug!: string; @IsString() category!: string; @IsObject() settings!: object; }
class JsonInput { @IsObject() data!: Record<string, unknown>; }
class WebsiteInput { @IsObject() model!: Record<string, unknown>; }
class AiPromptInput { @IsString() @MinLength(8) @MaxLength(1200) prompt!: string; @IsOptional() @IsIn(['create','modify']) mode?:'create'|'modify'; @IsOptional() @IsObject() model?:Record<string,unknown>; }
class AiHelpInput { @IsString() @MinLength(1) @MaxLength(2000) message!: string; @IsOptional() @IsObject() context?: Record<string, unknown>; }
class TokenInput { @IsString() @MinLength(32) @MaxLength(200) token!: string; }
class ResetInput extends TokenInput { @IsString() @MinLength(12) @MaxLength(200) password!: string; }
class EmailInput { @IsEmail() email!: string; }
class StripeSessionInput { @IsString() @MaxLength(200) sessionId!: string; }
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
const cookieOptions = (expires: Date) => {const sameSite=(process.env.NODE_ENV==='production'?'none':process.env.COOKIE_SAME_SITE||'lax') as 'lax'|'strict'|'none';return {httpOnly:true,secure:process.env.NODE_ENV==='production'||sameSite==='none',sameSite,expires,path:'/'};};

@Controller('auth')
export class AuthController {
  private logger=new Logger(AuthController.name);
  constructor(private db: DbService, private mail:MailService) {}
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('signup') async signup(@Req() req:Request, @Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    if (dto.acceptedTerms !== true) throw new BadRequestException('Accept the Terms of Service and Privacy Policy to create an account');
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where:{email} })) throw new ConflictException('Account already exists');
    const activationStartedAt = new Date();
    const businessName = dto.businessName?.trim() || '';
    const slugBase = businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'business';
    let user;
    try {
      user = await this.db.$transaction(async tx => {
        const created = await tx.user.create({ data:{ email, fullName:dto.fullName?.trim() || null, passwordHash:await argon2.hash(dto.password), role:'OWNER', emailVerifiedAt:new Date() } });
        await tx.termsConsent.create({data:{userId:created.id,termsVersion:'2026-10-31',privacyVersion:'2026-10-31'}});
        await tx.subscription.create({data:{userId:created.id,plan:'BASIC',status:'INACTIVE',billingType:'ONE_TIME',trialEndsAt:activationStartedAt}});
        const business=await tx.business.create({data:{ownerId:created.id,name:businessName,slug:`${slugBase}-${created.id.slice(-6)}`,website:{create:{}}}});
        const previewToken=String((req as any).cookies?.cyb_preview||'');
        if(previewToken.length>=32){
          const preview=await tx.trialPreview.findFirst({where:{tokenHash:tokenHash(previewToken),expiresAt:{gt:new Date()},generatedAt:{not:null},claimedUserId:null}});
          if(preview?.draft){
            await tx.website.update({where:{businessId:business.id},data:{draft:validateWebsite(preview.draft,false) as any}});
            await tx.trialPreview.update({where:{id:preview.id},data:{claimedUserId:created.id}});
          }
        }
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Account already exists');
      throw error;
    }
    await this.issueSession(user.id,res);
    res.clearCookie('cyb_preview',{path:'/'});
    return { id:user.id, email:user.email, emailVerified:true };
  }
  @Throttle({default:{limit:8,ttl:60_000}})
  @Post('login') async login(@Body() dto: LoginCredentials, @Res({ passthrough:true }) res: Response) {
    const user = await this.db.user.findUnique({ where:{ email:dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash,dto.password))) throw new BadRequestException('Invalid email or password');
    await this.issueSession(user.id,res); return { id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt };
  }
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('migrate-session') async migrateLegacySession(@Body() dto:LegacySessionInput,@Res({passthrough:true}) res:Response) {
    const now=new Date(),expires=new Date(now.getTime()+14*864e5),oldHash=tokenHash(dto.sessionToken),token=randomBytes(32).toString('base64url');
    const rotated=await this.db.$transaction(async tx=>{
      const old=await tx.session.findUnique({where:{tokenHash:oldHash},include:{user:true}});
      if(!old||old.expiresAt<=now)return null;
      const removed=await tx.session.deleteMany({where:{id:old.id,expiresAt:{gt:now}}});
      if(removed.count!==1)return null;
      await tx.session.create({data:{userId:old.userId,tokenHash:tokenHash(token),expiresAt:expires}});
      return old.user;
    });
    if(!rotated)throw new UnauthorizedException('Session expired');
    res.cookie('getcyb_session',token,cookieOptions(expires));
    return {id:rotated.id,email:rotated.email,emailVerified:!!rotated.emailVerifiedAt,role:rotated.role};
  }
  @Throttle({default:{limit:8,ttl:60_000}})
  @Post('google') async googleSignIn(@Body() dto:GoogleSignInInput,@Res({passthrough:true}) res:Response) {
    const clientId=process.env.GOOGLE_CLIENT_ID;
    if(!clientId)throw new ServiceUnavailableException('Google sign-in is not configured');
    let claims:any;
    try {
      const response=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('rejected');
      claims=await response.json();
    } catch { throw new BadRequestException('Google sign-in could not be verified. Please try again.'); }
    if(claims.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||!claims.sub||Number(claims.exp)*1000<=Date.now()||!(claims.email_verified===true||claims.email_verified==='true'))
      throw new BadRequestException('Google sign-in could not be verified. Please try again.');
    const email=String(claims.email||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email))throw new BadRequestException('Google did not provide a verified email address.');
    let user=await this.db.googleIdentity.findUnique({where:{subject:String(claims.sub)},include:{user:true}}).then((identity:any)=>identity?.user||null);
    if(user){await this.issueSession(user.id,res);return {id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt};}
    if(await this.db.user.findUnique({where:{email}}))throw new ConflictException('An account already exists. Sign in with email and password to access it.');
    if(dto.acceptedTerms!==true)throw new BadRequestException('Accept the Terms of Service and Privacy Policy to create an account');
    const activationStartedAt=new Date(),fullName=String(claims.name||'').trim().slice(0,120)||null;
    const slugBase=(fullName||email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'business';
    try {
      user=await this.db.$transaction(async tx=>{
        const created=await tx.user.create({data:{email,fullName,role:'OWNER',emailVerifiedAt:new Date()}});
        await tx.googleIdentity.create({data:{userId:created.id,subject:String(claims.sub)}});
        await tx.termsConsent.create({data:{userId:created.id,termsVersion:'2026-10-31',privacyVersion:'2026-10-31'}});
        await tx.subscription.create({data:{userId:created.id,plan:'BASIC',status:'INACTIVE',billingType:'ONE_TIME',trialEndsAt:activationStartedAt}});
        await tx.business.create({data:{ownerId:created.id,name:fullName||'',slug:`${slugBase}-${created.id.slice(-6)}`,website:{create:{}}}});
        return created;
      });
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('This Google account is already registered. Please sign in again.');
      throw error;
    }
    await this.issueSession(user.id,res);return {id:user.id,email:user.email,emailVerified:true};
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
  @UseGuards(SessionGuard) @Get('staging-mail-diagnostic') async stagingMailDiagnostic() {
    if (!stagingDiagnosticsEnabled()) throw new NotFoundException();
    return this.mail.verifySmtp();
  }
  @Throttle({default:{limit:3,ttl:60_000}})
  @Post('forgot-password') async forgotPassword(@Body() dto:EmailInput) {
    const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()}});
    if(user) {
      try { await this.createEmailLink(user.id,user.email,'reset'); this.logger.log(JSON.stringify({event:'password_reset_email_submitted',type:'reset'})); }
      catch(error) {
        const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';
        const responseCode=typeof error==='object'&&error&&'responseCode' in error?Number(error.responseCode):undefined;
        const reason=error instanceof ServiceUnavailableException?error.message:code==='EAUTH'||(responseCode!==undefined&&responseCode>=530&&responseCode<=539)?'SMTP authentication failed':['ECONNECTION','ETIMEDOUT','ENOTFOUND','ESOCKET'].includes(code)?'SMTP connection failed':'SMTP submission failed';
        this.logger.error(JSON.stringify({event:'password_reset_email_failed',reason,code:code||undefined,responseCode}));
      }
    } else if(stagingDiagnosticsEnabled()) {
      this.logger.log(JSON.stringify({event:'password_reset_account_not_found',type:'reset'}));
    }
    return {ok:true,message:'If the account exists, a password reset link will be sent.'};
  }
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('reset-password') async resetPassword(@Body() dto:ResetInput) {
    const record=await this.db.passwordResetToken.findUnique({where:{tokenHash:tokenHash(dto.token)}});
    if(!record||record.expiresAt<=new Date()) throw new BadRequestException('Password reset link is invalid or expired');
    const passwordHash=await argon2.hash(dto.password);
    const consumed=await this.db.$transaction(async tx=>{
      const consumed=await tx.passwordResetToken.deleteMany({where:{tokenHash:tokenHash(dto.token),expiresAt:{gt:new Date()}}});
      if(consumed.count!==1)return false;
      await tx.user.update({where:{id:record.userId},data:{passwordHash}});
      await tx.passwordResetToken.deleteMany({where:{userId:record.userId}});
      await tx.session.deleteMany({where:{userId:record.userId}});
      return true;
    });
    if(!consumed)throw new BadRequestException('Password reset link is invalid or expired');
    return {reset:true};
  }
  private async createEmailLink(userId:string,email:string,type:'verify'|'reset') {
    const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+(type==='verify'?24:0.5)*3600_000),hash=tokenHash(token);
    if(type==='verify') { await this.db.verificationToken.deleteMany({where:{userId}}); await this.db.verificationToken.create({data:{userId,tokenHash:hash,expiresAt}}); }
    else {
      // Keep any prior usable link until SMTP accepts this one. If sending fails,
      // remove only the token that was never delivered.
      await this.db.passwordResetToken.create({data:{userId,tokenHash:hash,expiresAt}});
      try {
        await this.mail.sendAccountLink(email,token,type);
      } catch(error) {
        try { await this.db.passwordResetToken.deleteMany({where:{tokenHash:hash}}); }
        catch { this.logger.error(JSON.stringify({event:'password_reset_token_cleanup_failed'})); }
        throw error;
      }
      return;
    }
    await this.mail.sendAccountLink(email,token,type);
  }
  private async issueSession(userId:string,res:Response):Promise<void> {
    const token=randomBytes(32).toString('base64url'), expires=new Date(Date.now()+14*864e5);
    await this.db.session.create({ data:{ userId, tokenHash:tokenHash(token), expiresAt:expires } }); res.cookie('getcyb_session',token,cookieOptions(expires));
  }
  @UseGuards(SessionGuard) @Get('me') async me(@Req() req:Request & {user:any}) {
    const subscription=await this.db.subscription.findUnique({where:{userId:req.user.id}});
    const paid=subscription?.status==='ACTIVE'&&subscription?.billingType==='ONE_TIME';
    return {
      id:req.user.id,
      email:req.user.email,
      emailVerified:!!req.user.emailVerifiedAt,
      role:req.user.role,
      paid,
      trialActive:false,
      trialEndsAt:null,
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
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.business(req.user.id);return this.db.product.findMany({where:{businessId:b.id},orderBy:{c…4232 tokens truncated…oughtful edit',body:'A preview of how your offer can come to life. Add your real products and details when you make your website yours.',limit:3},
    {id:'preview-faq',type:'faq',title:'A few good questions',body:'Clear answers help people feel at home.',items:[{question:'What makes this different?',answer:'A considered approach, shaped around what you need.'},{question:'How do I get started?',answer:'Tell us what you are looking for and we will help you take the next step.'}]},
    {id:'preview-footer',type:'footer',title:brandName,body:'A little more care in every detail.'}
  ];
  const dark=/\b(black|dark|midnight|charcoal)\b/.test(lower),primaryColor=/\b(green|sage|olive)\b/.test(lower)?'#647261':/\b(blue|navy)\b/.test(lower)?'#35465e':p.accent;
  return {editorVersion:2,brandName,description:p.body,tagline:p.eyebrow,backgroundColor:dark?'#211f1d':'#f7f3ec',textColor:dark?'#f4efe8':'#28231f',primaryColor:dark?'#c9a785':primaryColor,bodyFont:'Arial, sans-serif',headingFont:/\b(sans|modern|minimalist)\b/.test(lower)?'DM Sans, Arial, sans-serif':'Georgia, serif',buttonRadius:'0px',pages:[{id:'home',slug:'',title:'Home',sections}]};
}

@Controller('try')
export class TrialPreviewController {
  constructor(private db:DbService){}
  private cookie(res:Response,token:string){res.cookie('cyb_preview',token,{httpOnly:true,secure:true,sameSite:'none',path:'/',maxAge:7*864e5});}
  @Throttle({default:{limit:12,ttl:60_000}})
  @Post('session') async session(@Req() req:Request,@Res({passthrough:true}) res:Response){
    await this.db.trialPreview.deleteMany({where:{expiresAt:{lte:new Date()}}});
    const token=String((req as any).cookies?.cyb_preview||'');
    if(token.length>=32){const found=await this.db.trialPreview.findFirst({where:{tokenHash:tokenHash(token),expiresAt:{gt:new Date()},claimedUserId:null}});if(found){this.cookie(res,token);return {expiresAt:found.expiresAt.toISOString(),generated:!!found.generatedAt};}}
    const next=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+7*864e5);
    await this.db.trialPreview.create({data:{tokenHash:tokenHash(next),expiresAt}});this.cookie(res,next);return {expiresAt:expiresAt.toISOString(),generated:false};
  }
  @Throttle({default:{limit:5,ttl:60_000}})
  @Get('preview') async getPreview(@Req() req:Request){const token=String((req as any).cookies?.cyb_preview||'');if(token.length<32)throw new UnauthorizedException('Start a free preview first.');const row=await this.db.trialPreview.findFirst({where:{tokenHash:tokenHash(token),expiresAt:{gt:new Date()},claimedUserId:null}});if(!row)throw new NotFoundException('This preview has expired. Start a new preview to continue.');return {model:row.draft,generated:!!row.generatedAt,expiresAt:row.expiresAt.toISOString()};}
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('generate') async generate(@Req() req:Request,@Body() dto:AiPromptInput){const token=String((req as any).cookies?.cyb_preview||'');if(token.length<32)throw new UnauthorizedException('Start a free preview first.');const hash=tokenHash(token),prior=await this.db.trialPreview.findFirst({where:{tokenHash:hash,expiresAt:{gt:new Date()},claimedUserId:null}});if(!prior)throw new NotFoundException('This preview has expired. Start a new preview to continue.');if(prior.generatedAt)return {model:prior.draft,generated:true,expiresAt:prior.expiresAt.toISOString()};const model=validateWebsite(deterministicTrialWebsite(dto.prompt),false),result=await this.db.trialPreview.updateMany({where:{id:prior.id,generatedAt:null,expiresAt:{gt:new Date()},claimedUserId:null},data:{draft:model as any,prompt:dto.prompt.trim().slice(0,1200),generatedAt:new Date()}});if(!result.count){const latest=await this.db.trialPreview.findUnique({where:{id:prior.id}});if(latest?.draft)return {model:latest.draft,generated:true,expiresAt:latest.expiresAt.toISOString()};throw new ConflictException('The free preview has already been used.');}return {model,generated:true,expiresAt:prior.expiresAt.toISOString()};}
  @Throttle({default:{limit:30,ttl:60_000}})
  @Put('draft') async save(@Req() req:Request,@Body() dto:WebsiteInput){const token=String((req as any).cookies?.cyb_preview||'');if(token.length<32)throw new UnauthorizedException('Start a free preview first.');const model=validateWebsite(dto.model,false),result=await this.db.trialPreview.updateMany({where:{tokenHash:tokenHash(token),expiresAt:{gt:new Date()},generatedAt:{not:null},claimedUserId:null},data:{draft:model as any}});if(!result.count)throw new NotFoundException('This preview has expired or is no longer available.');return {saved:true};}
}

@Controller('websites')
export class WebsiteController {
  constructor(private db:DbService){}
  private async businessFor(req:Request & {user:any}){const business=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!business)throw new NotFoundException('Create a business first');return business;}
  private async requirePaidPublishing(userId:string){const access=await this.db.subscription.findUnique({where:{userId}});if(access?.status!=='ACTIVE'||access.billingType!=='ONE_TIME')throw new ForbiddenException('Activate CYB Lifetime Access before publishing your website. Your draft is saved.');}
  @UseGuards(SessionGuard) @Get('ai/status') async aiStatus(){return {available:Boolean(process.env.OPENAI_API_KEY?.trim()),usageLimited:false};}
  @UseGuards(SessionGuard) @Throttle({default:{limit:8,ttl:60_000}}) @Post('ai/design') async aiDesign(@Req() req:Request & {user:any},@Body() dto:AiPromptInput){
    const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('AI design is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');
    const modelName=process.env.OPENAI_MODEL||'gpt-4o-mini';
    const isModify=dto.mode==='modify';
    const currentModel=isModify?validateWebsite(dto.model,false):null;
    const instructions=isModify
      ? 'Edit the existing CYB website through a small set of structured operations. Return JSON only: {operations:[...]} . Allowed operations: {type:"site_style",fields:{brandName?,tagline?,description?,primaryColor?,backgroundColor?,textColor?,bodyFont?,headingFont?,buttonRadius?}}; {type:"update_section",pageId?,sectionId,fields:{title?,body?,buttonText?,eyebrow?,href?,variant?,limit?,image?,images?,media?,imagePlaceholderCount?,style?:{fontFamily?,fontSize?,color?,backgroundColor?,textAlign?,paddingY?,letterSpacing?,lineHeight?,maxWidth?,minHeight?,hidden?},responsive?:{laptop?:style,ipad?:style,phone?:style}}}; {type:"add_section",pageId?,afterSectionId?,section:{type,label,title,body,buttonText?,eyebrow?,href?,variant?,limit?,items?,images?,imagePlaceholderCount?}}. Add sections may use hero, about, services, gallery, collection, faq, reviews, contact, footer, heading, text, button, photo, divider, or spacer. For gallery placeholders use imagePlaceholderCount:3 (1–8) or images with safe HTTPS/upload URLs; do not create `items` for galleries. A collection section renders real products already in the store; use limit:6 when asked for six products and never invent product records. For a mobile-friendly request, use responsive.phone and responsive.ipad overrides on relevant sections (smaller fontSize, reasonable paddingY and maxWidth; do not set fixed minHeight). {type:"move_section",pageId?,sectionId,beforeSectionId}; {type:"delete_section",pageId?,sectionId}. Use exact existing pageId and sectionId values from the website JSON. Do not replace the model or remove any content unless the user explicitly asks for deletion. Do not invent customer reviews, products, prices, metrics, or image URLs. For a request for reviews, add a section with clear editable placeholders requesting real customer quotes. For a visual or copy change, update only the relevant site or section fields. Return a short summary in an optional summary string. If the request cannot be mapped safely, return {operations:[]}.'
      : 'Create a complete, polished ecommerce or service-business website for CYB. Return JSON only with {brandName,primaryColor,backgroundColor,textColor,bodyFont,headingFont,buttonRadius,sections}. sections is an array of 4 to 10 objects with unique id, type, label, title, body and optional buttonText/items/imagePlaceholderCount. Use only types hero, about, services, collection, gallery, faq, reviews, contact, footer. Include one hero and one footer, plus the relevant sections for this business such as about, product collection, gallery, FAQ, and contact. The website renderer adds an editable navigation header from the page list. Keep copy specific to the business. For unknown details, use clearly marked editable placeholders such as [Add your ingredients] instead of making claims. Never invent products, prices, customer reviews, ratings, or image URLs. If images are requested, add an editable gallery with imagePlaceholderCount:3 so the editor visibly shows replaceable image placeholders; do not return gallery items or fake URLs. If reviews are requested, create a reviews section with an editable placeholder for genuine customer quotes. Use collection for products that already exist in the store; otherwise say products will appear after they are added. Colors must be 6-digit hex.';
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
    const rawSections=Array.isArray(generated.sections)?generated.sections:[];const generatedSectionTypes=new Set(['hero','about','services','collection','gallery','faq','reviews','contact','footer']);if(rawSections.length<4||rawSections.length>10||!rawSections.some((section:any)=>section?.type==='hero')||!rawSections.some((section:any)=>section?.type==='footer')||rawSections.some((section:any)=>!section||typeof section!=='object'||Array.isArray(section)||!generatedSectionTypes.has(section.type)))throw new ServiceUnavailableException('AI returned an incomplete design. Please try again.');
    const safeGenerated=normalizeGeneratedWebsite(generated);const sections=safeGenerated.sections;
    for(const section of sections){
      if(section.type==='reviews')section.items=[{name:'Customer name',quote:'Add a real customer review here.'}];
      if(section.type==='gallery'&&/\b(images?|photos?|pictures?)\b/i.test(dto.prompt))section.imagePlaceholderCount=Math.max(1,Math.min(8,Number.isInteger(section.imagePlaceholderCount)?section.imagePlaceholderCount:3));
    }
    const draft=validateWebsite({editorVersion:2,...safeGenerated,pages:[{id:'home',slug:'',title:'Home',sections:sections.map((section:any,index:number)=>({...section,id:`ai-${Date.now()}-${index}`,style:{fontFamily:section.type==='hero'?'Georgia':'Arial',fontSize:section.type==='hero'?56:28,color:safeGenerated.textColor||'#171513'}}))}]},true);
    return {model:draft};
  }
  @UseGuards(SessionGuard) @Post('ai/help') async aiHelp(@Req() req:Request & {user:any},@Body() dto:AiHelpInput){const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('CYB AI help is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');const context=JSON.stringify(dto.context||{}).slice(0,4000);const data=await requestAiResponse({model:process.env.OPENAI_MODEL||'gpt-4o-mini',max_output_tokens:700,instructions:'You are the friendly CYB website-builder guide. Explain steps simply, help users understand the editor, and answer questions about designing their website. When users want design changes, direct them to the Edit my website tab, where their request will be applied as an editable change. Never claim to perform changes in this help chat. Keep the answer concise and do not invent features.',input:`Current website and recent conversation context: ${context}\nUser question: ${dto.message}`},apiKey,'AI help');const answer=aiResponseText(data);if(!answer)throw new ServiceUnavailableException('CYB AI returned an empty reply. Please try again.');return {answer};}
  @Throttle({default:{limit:5,ttl:60_000}}) @Post('public/ai/help') async publicAiHelp(@Body() dto:AiHelpInput){
    const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new ServiceUnavailableException('CYB AI help is unavailable because OPENAI_API_KEY is not configured on the API service. Please contact support.');
    const context=JSON.stringify(dto.context||{}).slice(0,4000);
    const data=await requestAiResponse({model:process.env.OPENAI_MODEL||'gpt-4o-mini',max_output_tokens:700,instructions:'You are the friendly CYB guide for visitors who have not created an account yet. Answer concise questions about CYB, starting a website, and the general website-building process. Do not claim to see or change a visitor’s account or website. If a question needs account-specific details, tell them to sign in. If you are unsure about a CYB feature, say so instead of guessing.',input:`Visitor context: ${context}\nQuestion: ${dto.message}`},apiKey,'AI help');
    const answer=aiResponseText(data);if(!answer)throw new ServiceUnavailableException('CYB AI returned an empty reply. Please try again.');return {answer};
  }
  @UseGuards(SessionGuard) @Get('draft') async draft(@Req() req:Request & {user:any}) {const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});return b?.website||null;}
  @UseGuards(SessionGuard) @Get('publication-diagnostic') async publicationDiagnostic(@Req() req:Request & {user:any}) {
    if(!stagingDiagnosticsEnabled())throw new NotFoundException();
    const business=await this.businessFor(req),website=await this.db.website.findUnique({where:{businessId:business.id}});
    const paths=publicationDifferencePaths(website?.draft as any,website?.published as any);
    const hasPublished=!!website?.published,hasPublishedAt=!!website?.publishedAt;
    const status=!hasPublished||!hasPublishedAt?'Draft':paths.length?'Unpublished changes':'Published';
    return {status,hasDraft:!!website?.draft,hasPublished,hasPublishedAt,changedPathCount:paths.length,changedPaths:paths.slice(0,80),truncated:paths.length>80};
  }
  @UseGuards(SessionGuard) @Put('draft') async saveDraft(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business first');const model=validateWebsite(dto.model,false);await assertOwnedMedia(this.db,req.user.id,model);return this.db.website.upsert({where:{businessId:b.id},create:{businessId:b.id,draft:model as any},update:{draft:model as any,revision:{increment:1}}});}
  @UseGuards(SessionGuard) @Post('publish') async publish(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business before publishing');await this.requirePaidPublishing(req.user.id);const model=validateWebsite(dto.model,true);await assertOwnedMedia(this.db,req.user.id,model);return this.db.$transaction(async tx=>{const publishedAt=new Date();const site=await tx.website.upsert({where:{businessId:b.id},create:{businessId:b.id,draft:model as any,published:publicWebsite(model) as any,publishedAt},update:{draft:model as any,published:publicWebsite(model) as any,publishedAt,revision:{increment:1}}});const version=await tx.websiteVersion.create({data:{websiteId:site.id,snapshot:site.draft as any}});return {published:true,revision:site.revision,slug:b.slug,versionId:version.id};});}
  @UseGuards(SessionGuard) @Post('unpublish') async unpublish(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');return this.db.website.updateMany({where:{businessId:b.id},data:{published:Prisma.DbNull,publishedAt:null}});}
  @UseGuards(SessionGuard) @Get('versions') async versions(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)return [];return (await this.db.websiteVersion.findMany({where:{websiteId:b.website.id},orderBy:{createdAt:'desc'},take:10})).map(({snapshot,createdAt,...version})=>({...version,model:snapshot,publishedAt:createdAt}));}
  @UseGuards(SessionGuard) @Post('restore/:id') async restore(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website not found');const version=await this.db.websiteVersion.findFirst({where:{id:String(req.params['id']),websiteId:b.website.id}});if(!version)throw new NotFoundException('Version not found');const model=validateWebsite(version.snapshot,false);return this.db.website.update({where:{businessId:b.id},data:{draft:model as any,revision:{increment:1}}});}
  @Get('public/:slug') async publicSite(@Req() req:Request){const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug}});if(!business)throw new NotFoundException('Website not found');const site=await this.db.website.findUnique({where:{businessId:business.id}});return {business:{name:business.name,slug:business.slug,category:business.category},website:site?.published||null,published:!!site?.published};}
}

class MediaUploadInput {
  @IsString() @IsIn(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']) contentType!: string;
  @IsNumber() size!: number;
  @IsString() @MaxLength(44) checksum!: string;
}

@Controller('uploads')
export class UploadController {
  constructor(private mediaStorage: MediaStorage) {}
  @UseGuards(SessionGuard) @Get('status') status() { return this.mediaStorage.status(); }
  @UseGuards(SessionGuard) @Post('authorize') authorize(@Req() req: Request & {user:any}, @Body() dto: MediaUploadInput) { return this.mediaStorage.authorize(req.user.id, dto); }
  @UseGuards(SessionGuard) @Post('complete/:id') complete(@Req() req: Request & {user:any}) { return this.mediaStorage.complete(req.user.id, String(req.params['id'])); }
  @Throttle({default:{limit:600,ttl:60_000}})
  @Get('media/:id') async media(@Req() req: Request, @Res() response: Response) { response.setHeader('Cache-Control','no-store'); response.setHeader('Cross-Origin-Resource-Policy','cross-origin'); return response.redirect(307, await this.mediaStorage.publicUrl(String(req.params['id']))); }

  @UseGuards(SessionGuard)
  @Post() async upload(@Req() req:Request & {user:any},@Headers('content-type') contentType:string,@Req() request:Request,@Res() response:Response) {
    const bytes=Buffer.isBuffer(request.body)?request.body:Buffer.alloc(0);
    if(bytes.length<1||bytes.length>MAX_UPLOAD_BYTES)throw new BadRequestException('Media files must be 4 MB or smaller on this legacy upload endpoint. Use direct uploads for larger files.');
    const result=await this.mediaStorage.uploadSmall(req.user.id,contentType,bytes);
    return response.status(201).json(result);
  }
  @Get(['businesses/:owner/:name', ':owner/:name']) async read(@Req() req:Request,@Res() response:Response) {
    const owner=String(req.params['owner']||''),name=String(req.params['name']||'');
    if(!/^[a-zA-Z0-9_-]{1,120}$/.test(owner)||!/^[a-f0-9]{36}$/.test(name))throw new NotFoundException('Image not found');
    const key=`businesses/${owner}/${name}`,store=legacyMediaStore();
    const metadata=await store.getMetadata(key);
    if(!metadata)throw new NotFoundException('Image not found');
    const image=await store.get(key,{type:'arrayBuffer'});
    response.setHeader('Cross-Origin-Resource-Policy','cross-origin');
    response.setHeader('Content-Type',String(metadata.metadata.contentType||'application/octet-stream'));
    response.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return response.status(200).send(Buffer.from(image));
  }
}

function legacyMediaStore() {
  try { return process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN ? getStore({name:'getcyb-assets',siteID:process.env.NETLIFY_BLOBS_SITE_ID,token:process.env.NETLIFY_BLOBS_TOKEN}) : getStore('getcyb-assets'); } catch { throw new ServiceUnavailableException('Legacy media storage is unavailable on this API. Use the updated direct upload flow or configure legacy Netlify Blobs access.'); }
}


@Controller('payments')
@UseGuards(SessionGuard)
export class PlatformRefundController {
  constructor(private db:DbService){}
  @Post('platform-access/refund') async refund(@Req() req:Request & {user:any}) {
    const payments=await this.db.paymentReference.findMany({
      where:{userId:req.user.id,provider:{in:['stripe','paypal']},status:{in:['COMPLETED','REFUNDED']}},
      orderBy:{createdAt:'desc'},
      take:20,
    });
    const payment=payments.find(item=>(item.metadata as any)?.intent==='PLATFORM_ACCESS');
    if(!payment)throw new NotFoundException('No completed platform payment was found');
    if(payment.status==='REFUNDED')return {success:true,status:'REFUNDED'};
    const paymentDate=new Date((payment.metadata as any)?.paidAt||payment.createdAt);
    if(!Number.isFinite(paymentDate.getTime())||Date.now()-paymentDate.getTime()>30*864e5)throw new BadRequestException('The 30-day refund period has ended');
    let refundId:string|undefined;
    if(payment.provider==='stripe') {
      const key=process.env.STRIPE_SECRET_KEY;
      const paymentIntentId=(payment.metadata as any)?.paymentIntentId;
      if(!key||typeof paymentIntentId!=='string'||!paymentIntentId.startsWith('pi_'))throw new ServiceUnavailableException('This Stripe payment cannot be refunded automatically. Please contact support.');
      const form=new URLSearchParams({payment_intent:paymentIntentId});
      let response:globalThis.Response;
      try { response=await fetch('https://api.stripe.com/v1/refunds',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`getcyb-refund-${payment.id}`},body:form.toString(),signal:AbortSignal.timeout(20000)}); }
      catch { throw new ServiceUnavailableException('The refund provider could not be reached. Please try again.'); }
      const result=await response.json().catch(()=>({})) as any;
      if(!response.ok||!result.id)throw new BadRequestException('Stripe could not process the refund. Please try again.');
      refundId=result.id;
    } else {
      const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
      const captureId=payment.providerCaptureId;
      if(!id||!secret||!captureId)throw new ServiceUnavailableException('This PayPal payment cannot be refunded automatically. Please contact support.');
      const base=process.env.PAYPAL_API_BASE||'https://api-m.sandbox.paypal.com';
      const tokenResponse=await fetch(`${base}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});
      const tokenData=await tokenResponse.json().catch(()=>({})) as any;
      if(!tokenResponse.ok||!tokenData.access_token)throw new ServiceUnavailableException('PayPal could not authorize the refund. Please try again.');
      const response=await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,{method:'POST',headers:{Authorization:`Bearer ${tokenData.access_token}`,'Content-Type':'application/json','PayPal-Request-Id':`getcyb-refund-${payment.id}`},body:JSON.stringify({})});
      const result=await response.json().catch(()=>({})) as any;
      if(!response.ok||!result.id)throw new BadRequestException('PayPal could not process the refund. Please try again.');
      refundId=result.id;
    }
    await this.db.$transaction([
      this.db.paymentReference.update({where:{id:payment.id},data:{status:'REFUNDED',metadata:{...(payment.metadata as any),refundId,refundedAt:new Date().toISOString()}}}),
      this.db.subscription.updateMany({where:{userId:req.user.id},data:{status:'INACTIVE',billingType:'ONE_TIME'}}),
    ]);
    return {success:true,status:'REFUNDED'};
  }
}


@Controller('payments/stripe')
@UseGuards(SessionGuard)
export class StripeController {
  constructor(private db:DbService){}
  private isStripeTestKey(key=process.env.STRIPE_SECRET_KEY||'') {
    return /^(sk|rk)_test_/.test(key.trim());
  }
  private async stripeRequest(path:string, init:RequestInit={}) {
    const key=process.env.STRIPE_SECRET_KEY;
    if(!key)throw new BadRequestException('Stripe is not configured');
    let response:globalThis.Response;
    try { response=await fetch(`https://api.stripe.com/v1${path}`,{...init,headers:{Authorization:`Bearer ${key}`,...(init.headers||{})},signal:AbortSignal.timeout(20000)}); }
    catch { throw new ServiceUnavailableException('Stripe could not be reached. Please try again.'); }
    const body=await response.json().catch(()=>({})) as any;
    if(!response.ok) {
      Logger.error(JSON.stringify({status:response.status,code:body.error?.code||'unknown',type:body.error?.type||'unknown'}),'Stripe');
      throw new BadRequestException('Stripe could not complete the payment request. Please try again.');
    }
    return body;
  }
  @Get('staging-status') async stagingStatus() {
    if(!stagingDiagnosticsEnabled())throw new NotFoundException();
    const key=process.env.STRIPE_SECRET_KEY?.trim()||'';
    const testMode=this.isStripeTestKey(key);
    let verified=false;
    if(testMode) {
      try { const balance=await this.stripeRequest('/balance'); verified=balance.object==='balance'&&balance.livemode===false; }
      catch { verified=false; }
    }
    const amount=process.env.STRIPE_BASIC_AMOUNT||'24600';
    const currency=(process.env.STRIPE_CURRENCY||'usd').toLowerCase();
    return {configured:!!key,testMode,verified,amountCents:/^\d+$/.test(amount)?Number(amount):null,currency:/^[a-z]{3}$/.test(currency)?currency:null};
  }
  @Post('checkout-sessions') async createCheckoutSession(@Req() req:Request & {user:any}) {
    const amount=process.env.STRIPE_BASIC_AMOUNT||'24600',currency=(process.env.STRIPE_CURRENCY||'usd').toLowerCase();
    if(stagingDiagnosticsEnabled()&&!this.isStripeTestKey())throw new ServiceUnavailableException('Staging checkout requires a Stripe test-mode key.');
    if(!/^\d+$/.test(amount)||Number(amount)<50||!/^[a-z]{3}$/.test(currency))throw new BadRequestException('Stripe price configuration is invalid');
    let appUrl:string;
    try { const parsed=new URL(process.env.PUBLIC_APP_URL||'https://getcyb.fit'); if(!['https:','http:'].includes(parsed.protocol))throw new Error(); appUrl=parsed.origin; }
    catch { throw new BadRequestException('Stripe return URL configuration is invalid'); }
    const form=new URLSearchParams({
      mode:'payment',
      success_url:`${appUrl}/platform-payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${appUrl}/platform-payment?stripe_cancelled=1`,
      client_reference_id:req.user.id,
      'metadata[userId]':req.user.id,
      'metadata[intent]':'PLATFORM_ACCESS',
      'line_items[0][price_data][currency]':currency,
      'line_items[0][price_data][unit_amount]':amount,
      'line_items[0][price_data][product_data][name]':Number(amount)===100?'CYB Stripe Test Payment':'CYB Lifetime Access',
      'line_items[0][price_data][product_data][description]':Number(amount)===100?'Temporary staging payment verification':'One-time payment for lifetime access to CYB',
      'line_items[0][quantity]':'1',
    });
    const session=await this.stripeRequest('/checkout/sessions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
    if(!session.id||!session.url)throw new ServiceUnavailableException('Stripe did not return a checkout link. Please try again.');
    await this.db.paymentReference.create({data:{provider:'stripe',providerOrderId:session.id,status:'PENDING',amountCents:Number(amount),currency:currency.toUpperCase(),userId:req.user.id,metadata:{intent:'PLATFORM_ACCESS'}}});
    return {url:session.url};
  }
  @Post('confirm-checkout') async confirmCheckout(@Req() req:Request & {user:any},@Body() dto:StripeSessionInput) {
    if(stagingDiagnosticsEnabled()&&!this.isStripeTestKey())throw new ServiceUnavailableException('Staging checkout requires a Stripe test-mode key.');
    const payment=await this.db.paymentReference.findUnique({where:{providerOrderId:dto.sessionId}});
    if(!payment||payment.provider!=='stripe'||payment.userId!==req.user.id)throw new NotFoundException('Stripe checkout session not found');
    if(payment.status==='COMPLETED')return {success:true,status:'COMPLETED'};
    if(payment.status!=='PENDING')throw new BadRequestException('Stripe checkout session cannot be confirmed');
    const session=await this.stripeRequest(`/checkout/sessions/${encodeURIComponent(dto.sessionId)}`);
    await activateVerifiedStripeSession(this.db,payment,session);
    return {success:true,status:'COMPLETED'};
  }
}

async function activateVerifiedStripeSession(db:DbService,payment:any,session:any) {
    const valid=session.id===payment.providerOrderId&&(!stagingDiagnosticsEnabled()||session.livemode===false)&&session.mode==='payment'&&session.payment_status==='paid'&&session.client_reference_id===payment.userId&&session.metadata?.userId===payment.userId&&session.metadata?.intent==='PLATFORM_ACCESS'&&session.currency===payment.currency.toLowerCase()&&session.amount_total===payment.amountCents;
    if(!valid)throw new BadRequestException('Stripe payment verification failed');
    await db.$transaction(async tx=>{
      const updated=await tx.paymentReference.updateMany({where:{id:payment.id,status:'PENDING'},data:{status:'COMPLETED',providerCaptureId:session.id,metadata:{intent:'PLATFORM_ACCESS',stripeSessionId:session.id,paymentIntentId:session.payment_intent||null,paidAt:new Date().toISOString()}}});
      if(!updated.count) {
        const current=await tx.paymentReference.findUnique({where:{id:payment.id}});
        if(current?.status==='COMPLETED')return;
        throw new BadRequestException('Stripe payment is already being confirmed');
      }
      await tx.subscription.upsert({where:{userId:payment.userId},create:{userId:payment.userId,plan:'BASIC',status:'ACTIVE',billingType:'ONE_TIME',trialEndsAt:new Date()},update:{status:'ACTIVE',billingType:'ONE_TIME'}});
    });
}

// Stripe authenticates this endpoint with a signature over the original bytes.
@Controller('payments/stripe/webhook')
export class StripeWebhookController {
  constructor(private db:DbService){}
  @Post() async receive(@Req() req:Request) {
    const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if(!secret)throw new ServiceUnavailableException('Stripe webhook is not configured');
    const signature=req.headers['stripe-signature'];
    if(!Buffer.isBuffer(req.body)||typeof signature!=='string')throw new BadRequestException('Invalid Stripe signature');
    const parts=signature.split(',').map(part=>part.trim().split('='));
    const timestamps=parts.filter(([key])=>key==='t').map(([,value])=>value);
    if(timestamps.length!==1||!/^\d+$/.test(timestamps[0])||Math.abs(Date.now()/1000-Number(timestamps[0]))>300)throw new BadRequestException('Invalid Stripe signature');
    const expected=createHmac('sha256',secret).update(timestamps[0]+'.').update(req.body).digest();
    const valid=parts.some(([key,value])=>key==='v1'&&/^[a-f0-9]{64}$/i.test(value||'')&&timingSafeEqual(expected,Buffer.from(value,'hex')));
    if(!valid)throw new BadRequestException('Invalid Stripe signature');
    let event:any;
    try { event=JSON.parse(req.body.toString('utf8')); } catch { throw new BadRequestException('Invalid Stripe event'); }
    if(!event||typeof event!=='object')throw new BadRequestException('Invalid Stripe event');
    const key=process.env.STRIPE_SECRET_KEY?.trim()||'';
    const testKey=/^(sk|rk)_test_/.test(key);
    if(!/^(sk|rk)_(test|live)_/.test(key))throw new ServiceUnavailableException('Stripe is not configured');
    if(stagingDiagnosticsEnabled()&&(!testKey||event.livemode!==false))throw new BadRequestException('Staging requires test-mode events');
    if(event.livemode!==!testKey)throw new BadRequestException('Stripe event mode does not match configuration');
    if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return {received:true};
    const session=event.data?.object;
    if(!session||typeof session.id!=='string')throw new BadRequestException('Invalid Stripe session');
    if(session.payment_status!=='paid')return {received:true};
    const payment=await this.db.paymentReference.findUnique({where:{providerOrderId:session.id}});
    // An event can race the checkout response's local payment-reference write.
    // Return a retryable failure instead of silently dropping a paid activation.
    if(!payment||payment.provider!=='stripe')throw new ServiceUnavailableException('Checkout reference is not ready');
    if(payment.status==='COMPLETED')return {received:true};
    if(payment.status!=='PENDING')throw new BadRequestException('Checkout cannot be activated');
    await activateVerifiedStripeSession(this.db,payment,session);
    return {received:true};
  }
}
