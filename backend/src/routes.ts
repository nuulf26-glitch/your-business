import { Body, Controller, Get, Post, Put, Patch, Delete, Req, Res, UseGuards, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger, ServiceUnavailableException, Headers, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsNumber, IsString, MinLength, MaxLength, IsObject, IsOptional, IsIn, IsBoolean, IsInt, Min, Matches } from 'class-validator';
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
import { expectedStripeMode, stripeKeyMode, stripeModeMatchesApplication } from './stripe-mode';
import { productDataValidationError } from './product-policy';
import { calculateStoreOrderTotals, validateStoreCommerceSettings } from './store-commerce-policy';
import { hasStagingTestPublishingEntitlement } from './staging-test-entitlement';
import { findPublishedContactForm, validatePublishedFormAnswers } from './form-policy';
import { orderPaymentStatus } from './order-payment-status';
import { decryptMerchantPaymentSecret, StripeGatewayAdapter } from './merchant-payments';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
function stagingDiagnosticsEnabled(){
  try { const app=new URL(process.env.PUBLIC_APP_URL||''); return app.protocol==='https:'&&app.hostname==='getcyb-staging-web.onrender.com'; }
  catch { return false; }
}

function collectedAmountCents(order:any):number {
  const data=(order?.data&&typeof order.data==='object'?order.data:order)||{};
  const history=Array.isArray(data.paymentHistory)?data.paymentHistory.filter((entry:any)=>entry?.type==='collected'):[];
  if(history.length)return history.reduce((sum:number,entry:any)=>sum+(Number(entry.amountCents)||0),0);
  const paymentStatus=String(data.paymentStatus||'').toLowerCase();
  if(!['paid','refunded'].includes(paymentStatus))return 0;
  return Number(data.collectedAmountCents??order?.amountCents??Math.round(Number(data.total||0)*100))||0;
}
function refundAmountCents(order:any):number {
  const data=(order?.data&&typeof order.data==='object'?order.data:order)||{};
  return Array.isArray(data.refundHistory)?data.refundHistory.reduce((sum:number,entry:any)=>sum+(Number(entry?.amountCents)||0),0):0;
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
async function selectedBusiness(db:DbService,req:Request & {user:any},include?:Record<string,unknown>):Promise<any>{const header=typeof req.get==='function'?req.get('x-cyb-business-id'):((req.headers as any)?.['x-cyb-business-id']);const id=String(header||'').trim();return db.business.findFirst({where:id?{ownerId:req.user.id,id}:{ownerId:req.user.id},...(include?{include}: {})});}
async function logCustomerActivity(db:DbService,businessId:string,customerId:string,eventKey:string,event:Record<string,unknown>){const id=`crm_evt_${createHash('sha256').update(`${businessId}:customer:${customerId}:${eventKey}`).digest('hex').slice(0,48)}`;await db.businessRecord.createMany({data:[{id,businessId,type:'crmActivity',data:{customerId,...event,eventKey,at:event.at||new Date().toISOString()}}],skipDuplicates:true});}
class JsonInput { @IsObject() data!: Record<string, unknown>; }
class CheckoutOrderInput extends JsonInput {
  @IsString() @Matches(/^[A-Za-z0-9_-]{32,128}$/) idempotencyKey!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{32,128}$/) customerActionToken!: string;
}
class WebsiteInput { @IsObject() model!: Record<string, unknown>; @IsOptional() @IsInt() @Min(0) expectedRevision?: number; }
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
// Keep the HttpOnly session cookie host-only. SameSite=Lax works when the
// frontend proxies /api on its own origin; use None only for cross-site APIs.
const cookieOptions = (expires: Date) => {
  const configured = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  const sameSite = (configured || 'lax') as 'lax' | 'strict' | 'none';
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production' || sameSite === 'none', sameSite, expires, path: '/' };
};

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
  @UseGuards(SessionGuard) @Get('mine') async mine(@Req() req:Request & {user:any}) { return selectedBusiness(this.db,req,{website:true}); }
  @UseGuards(SessionGuard) @Get('mine/stores') async stores(@Req() req:Request & {user:any}) {
    const rows=await this.db.business.findMany({where:{ownerId:req.user.id},include:{website:true},orderBy:{createdAt:'asc'}});
    return rows.map(row=>({id:row.id,name:row.name,slug:row.slug,category:row.category,createdAt:row.createdAt,published:!!row.website?.published}));
  }
  @UseGuards(SessionGuard) @Post('mine/stores') async createStore(@Req() req:Request & {user:any},@Body() dto:StoreInput) {
    const name=String(dto.name||'').trim(),slug=String(dto.slug||'').trim().toLowerCase();
    if(!name)throw new BadRequestException('Store name required');
    if(!/^[a-z0-9-]{1,100}$/.test(slug))throw new BadRequestException('Slug must use lowercase letters, numbers, and hyphens');
    const [count,existing]=await Promise.all([
      this.db.business.count({where:{ownerId:req.user.id}}),
      this.db.business.findUnique({where:{slug}}),
    ]);
    if(count>=20)throw new BadRequestException('An account can have up to 20 stores');
    if(existing)throw new ConflictException('Website address is already taken');
    const settings={...(dto.settings as Record<string,unknown>),storeName:name,businessName:name,storeUrl:slug};
    try{return await this.db.business.create({data:{ownerId:req.user.id,name,slug,category:dto.category||'general',settings:settings as any,website:{create:{}}}});}
    catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('Website address is already taken');throw error;}
  }
  @UseGuards(SessionGuard) @Get('mine/commerce-settings') async commerceSettings(@Req() req:Request & {user:any}) {
    const business=await selectedBusiness(this.db,req);
    if(!business)throw new NotFoundException('Business not found');
    const storeSettings=business.settings as Record<string,any>;return storeSettings?.commerceSettings||{currency:storeSettings?.currency||'USD',shippingZones:[],pickupEnabled:false,taxEnabled:false,taxRatePercent:0,discounts:[]};
  }
  @UseGuards(SessionGuard) @Put('mine/commerce-settings') async saveCommerceSettings(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await selectedBusiness(this.db,req);
    if(!business)throw new NotFoundException('Business not found');
    const error=validateStoreCommerceSettings(dto.data);
    if(error)throw new BadRequestException(error);
    const settings={...(business.settings as Record<string,unknown>),commerceSettings:dto.data};
    const saved=await this.db.business.update({where:{id:business.id},data:{settings:settings as any}});
    return (saved.settings as Record<string,any>).commerceSettings;
  }
  @UseGuards(SessionGuard) @Get('mine/catalog') async catalog(@Req() req:Request & {user:any}) {
    const business=await selectedBusiness(this.db,req);
    const settings=(business?.settings||{}) as Record<string,unknown>;
    return settings.businessCatalog||settings.catalog||null;
  }
  @UseGuards(SessionGuard) @Put('mine/catalog') async saveCatalog(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await selectedBusiness(this.db,req);
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
    const business=await selectedBusiness(this.db,req);
    if(!business)return [];
    const rows=await this.db.businessRecord.findMany({where:{businessId:business.id,type},orderBy:{createdAt:'desc'},take:300});
    return rows.map(row=>({...(row.data as Record<string,unknown>),id:row.id,type:row.type,status:row.status,read:row.read,createdAt:row.createdAt.toISOString()}));
  }
  @UseGuards(SessionGuard) @Get('mine/analytics') async analytics(@Req() req:Request & {user:any}) {
    const business=await selectedBusiness(this.db,req);if(!business)return {days:[],pages:[],sources:[]};
    const rows=await this.db.businessRecord.findMany({where:{businessId:business.id,type:{in:['bookings','inquiries','pickupOrders','pageViews']}},orderBy:{createdAt:'desc'},take:2000});
    const days=new Map<string,any>(),pages=new Map<string,number>(),sources=new Map<string,number>();for(const row of rows){const data=row.data as any,key=row.createdAt.toISOString().slice(0,10);const day=days.get(key)||{date:key,bookings:0,inquiries:0,orders:0,visits:0,pageViews:0};if(row.type==='bookings')day.bookings++;if(row.type==='inquiries')day.inquiries++;if(row.type==='pickupOrders')day.orders++;if(row.type==='pageViews'){day.pageViews++;if(data.uniqueVisit)day.visits++;pages.set(data.page,(pages.get(data.page)||0)+1);if(data.uniqueVisit)sources.set(data.source,(sources.get(data.source)||0)+1);}days.set(key,day);}
    return {days:[...days.values()].slice(0,30).sort((a,b)=>b.date.localeCompare(a.date)),pages:[...pages].map(([page,views])=>({page,views})).sort((a,b)=>b.views-a.views).slice(0,10),sources:[...sources].map(([source,visits])=>({source,visits})).sort((a,b)=>b.visits-a.visits).slice(0,10)};
  }
  @UseGuards(SessionGuard) @Get('mine/commerce-analytics') async commerceAnalytics(@Req() req:Request & {user:any}) {
    const business=await selectedBusiness(this.db,req);
    if(!business)return {revenue:0,netRevenue:0,grossCollected:0,orders:0,averageOrderValue:0,refunds:0,unpaidCodOrders:0,conversionRate:null,uniqueVisits:0,days:[],bestSellers:[],inventoryAlerts:[]};
    const [orders,products,views]=await Promise.all([
      this.db.order.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:3000}),
      this.db.product.findMany({where:{businessId:business.id},take:3000}),
      this.db.businessRecord.findMany({where:{businessId:business.id,type:'pageViews'},orderBy:{createdAt:'desc'},take:5000}),
    ]);
    const paid=orders.filter(row=>String((row.data as any)?.paymentStatus||'').toLowerCase()==='paid');
    const grossCollectedCents=orders.reduce((sum,row)=>sum+collectedAmountCents(row),0);
    const refundedCents=orders.reduce((sum,row)=>sum+refundAmountCents(row),0);
    const netRevenueCents=grossCollectedCents-refundedCents;
    const collectedOrders=orders.filter(row=>collectedAmountCents(row)>0).length;
    const days=new Map<string,{date:string,revenue:number,orders:number,refunds:number}>();
    const productsById=new Map(products.map(product=>[product.id,product.name]));
    const sold=new Map<string,{productId:string,name:string,quantity:number,revenue:number}>();
    for(const row of orders){
      const data=row.data as any,key=new Date(row.createdAt).toISOString().slice(0,10),day=days.get(key)||{date:key,revenue:0,orders:0,refunds:0};
      day.orders++;
      const collected=collectedAmountCents(row);
      const refunded=refundAmountCents(row);
      day.revenue+=(collected-refunded)/100;
      day.refunds+=refunded/100;
      if(String(data.paymentStatus||'').toLowerCase()==='paid'){
        for(const line of Array.isArray(data.items)?data.items:[]){const id=String(line.id||line.productId||''),quantity=Number(line.quantity)||0,current=sold.get(id)||{productId:id,name:String(line.name||productsById.get(id)||'Product'),quantity:0,revenue:0};current.quantity+=quantity;current.revenue+=(Number(line.price)||0)*quantity;sold.set(id,current);}
      }
      days.set(key,day);
    }
    const uniqueVisits=new Set(views.filter(row=>(row.data as any)?.uniqueVisit).map(row=>String((row.data as any)?.visitId||(row.data as any)?.sessionId||row.id))).size;
    const unpaidCodOrders=orders.filter(row=>['cash on delivery','pending'].includes(String((row.data as any)?.paymentStatus||'').toLowerCase())&&!['cancelled','returned'].includes(String((row.data as any)?.fulfillmentStatus||row.status).toLowerCase())).length;
    const inventoryAlerts=products.map(product=>({id:product.id,name:product.name,stock:Number((product.data as any)?.stock),threshold:Number((product.data as any)?.lowStockThreshold??5)})).filter(product=>Number.isFinite(product.stock)&&product.stock<=product.threshold).sort((a,b)=>a.stock-b.stock);
    return {revenue:netRevenueCents/100,netRevenue:netRevenueCents/100,grossCollected:grossCollectedCents/100,orders:orders.length,paidOrders:paid.length,collectedOrders,averageOrderValue:collectedOrders?grossCollectedCents/100/collectedOrders:0,refunds:refundedCents/100,unpaidCodOrders,uniqueVisits,conversionRate:uniqueVisits?paid.length/uniqueVisits: null,days:[...days.values()].slice(0,30).sort((a,b)=>a.date.localeCompare(b.date)),bestSellers:[...sold.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,10),inventoryAlerts};
  }
  @UseGuards(SessionGuard) @Get('mine/clients') async clients(@Req() req:Request & {user:any}) {
    const business=await selectedBusiness(this.db,req);if(!business)return [];
    const [bookings,notes]=await Promise.all([this.db.businessRecord.findMany({where:{businessId:business.id,type:'bookings'},orderBy:{createdAt:'desc'},take:300}),this.db.businessRecord.findMany({where:{businessId:business.id,type:'clientNotes'},take:500})]);
    const crypto=require('node:crypto'),noteMap=new Map(notes.map(note=>[(note.data as any).clientId,(note.data as any).note||''])),map=new Map<string,any>();
    for(const row of bookings){const data=row.data as any,email=String(data.email||'').toLowerCase();if(!email)continue;const id=crypto.createHash('sha256').update(email).digest('hex');const client=map.get(id)||{id,name:data.name||'',email,phone:data.phone||'',bookings:[],note:noteMap.get(id)||''};client.bookings.push({id:row.id,start:data.start,serviceName:data.serviceName||'Table reservation',status:row.status});map.set(id,client);}
    return [...map.values()];
  }
  @UseGuards(SessionGuard) @Put('mine/client-notes/:id') async saveClientNote(@Req() req:Request & {user:any},@Body() dto:JsonInput){const business=await selectedBusiness(this.db,req);if(!business)throw new NotFoundException('Business not found');const id=String(req.params['id']);if(!/^[a-f0-9]{64}$/.test(id))throw new BadRequestException('Invalid client');const note=String(dto.data.note||'').slice(0,5000);const prior=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'clientNotes',data:{path:['clientId'],equals:id}}});if(prior)return this.db.businessRecord.update({where:{id:prior.id},data:{data:{clientId:id,note} as any}});return this.db.businessRecord.create({data:{businessId:business.id,type:'clientNotes',data:{clientId:id,note} as any}});}
  @UseGuards(SessionGuard) @Patch('mine/records/:id/reschedule') async rescheduleBooking(@Req() req:Request & {user:any},@Body() dto:JsonInput){const business=await selectedBusiness(this.db,req);if(!business)throw new NotFoundException('Business not found');const row=await this.db.businessRecord.findFirst({where:{id:String(req.params['id']),businessId:business.id,type:'bookings',status:'confirmed'}});if(!row)throw new NotFoundException('Confirmed booking not found');const start=String(dto.data.start||''),startMs=Date.parse(start),catalog=(business.settings as any).businessCatalog;if(!Number.isFinite(startMs)||startMs<Date.now())throw new BadRequestException('Choose a future time');if(!catalog)throw new BadRequestException('Booking availability is not configured');return this.db.$transaction(async tx=>{const date=localParts(startMs,catalog.timeZone||'UTC').date;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${business.id}), hashtext(${date}))`;const rows=await tx.businessRecord.findMany({where:{businessId:business.id,type:'bookings'},take:1000});const current=row.data as any;let slot:any;try{slot=allocate(catalog,{kind:current.kind,start,serviceId:current.serviceId,staffId:current.staffId,guests:current.guests},rows.filter(item=>item.id!==row.id).map(item=>item.data));}catch(error){throw new BadRequestException(error instanceof Error?error.message:'This time is unavailable');}const data={...current,...slot,date:localParts(slot.start,catalog.timeZone||'UTC').date,start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString(),rescheduledAt:new Date().toISOString()};return tx.businessRecord.update({where:{id:row.id},data:{data:data as any}});});}
  @UseGuards(SessionGuard) @Post('mine/records/bookings') async createOwnerBooking(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await selectedBusiness(this.db,req);
    if(!business)throw new NotFoundException('Business not found');
    const data=dto.data as Record<string,unknown>;
    if(data.storeUrl&&data.storeUrl!==business.slug)throw new NotFoundException('Business not found');
    const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),start=String(data.start||'');
    if(!name||!/^\S+@\S+\.\S+$/.test(email)||!Number.isFinite(Date.parse(start)))throw new BadRequestException('Enter a customer, valid email, and booking time');
    const record=await this.db.businessRecord.create({data:{businessId:business.id,type:'bookings',status:'confirmed',data:{...data,name,email,start,kind:data.kind==='reservation'?'reservation':'appointment'} as any}});
    return {id:record.id,start,status:record.status};
  }
  @UseGuards(SessionGuard) @Patch('mine/records/:id') async updateRecord(@Req() req:Request & {user:any},@Body() dto:OrderStatusInput) {
    const business=await selectedBusiness(this.db,req);
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
    const current=await selectedBusiness(this.db,req);
    const existing=await this.db.business.findUnique({where:{slug:dto.slug}});
    if(existing&&existing.id!==current?.id)throw new ConflictException('Website address is already taken');
    if(current)return this.db.business.update({where:{id:current.id},data:{name:dto.name,slug:dto.slug,category:dto.category,settings:{...(current.settings as Record<string,unknown>),...dto.settings} as any}});
    return this.db.business.create({data:{ownerId:req.user.id,name:dto.name,slug:dto.slug,category:dto.category,settings:dto.settings,website:{create:{}}}});
  }
  @Get('public/:slug') async publicBusiness(@Req() req:Request) {
    const slug=String(req.params['slug']||'');
    const business=await this.db.business.findUnique({where:{slug},include:{website:true}});
    if(!business?.website?.published)throw new NotFoundException('Website not found');
    const settings=business.settings as Record<string,unknown>;
    const safeKeys=['storeName','businessName','description','storeDescription','logoUrl','coverImageUrl','contactEmail','contactPhone','themeColor','primaryColor','backgroundColor','textColor','template','cardStyle','businessCategory','currency','language'];
    const publicSettings=Object.fromEntries(safeKeys.filter(key=>typeof settings[key]==='string').map(key=>[key,settings[key]]));
    const catalog=settings.businessCatalog||settings.catalog;
    const commerce=settings.commerceSettings as Record<string,any>|undefined;
    const publicCommerce=commerce?{
      currency:commerce.currency,
      shippingZones:Array.isArray(commerce.shippingZones)?commerce.shippingZones.filter((zone:any)=>zone.enabled!==false).map((zone:any)=>({name:zone.name,countryCodes:zone.countryCodes,fee:zone.fee,freeShippingThreshold:zone.freeShippingThreshold})):[],
      pickupEnabled:commerce.pickupEnabled===true,
      taxEnabled:commerce.taxEnabled===true,
      taxRatePercent:commerce.taxRatePercent,
      taxShipping:commerce.taxShipping===true,
      taxLabel:commerce.taxLabel,
      discounts:Array.isArray(commerce.discounts)?commerce.discounts.filter((discount:any)=>discount.enabled!==false).map((discount:any)=>({code:discount.code,type:discount.type,value:discount.value,startsAt:discount.startsAt,endsAt:discount.endsAt})):[],
    }:undefined;
    return {id:business.id,name:business.name,slug:business.slug,category:business.category,settings:{...publicSettings,...(catalog?{businessCatalog:catalog,catalog}: {}),...(publicCommerce?{commerceSettings:publicCommerce}:{})}};
  }
}

@Controller('public')
export class PublicBusinessController {
  constructor(private db:DbService){}
  private async business(slug:string){const b=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!b?.website?.published)throw new NotFoundException('Website not found');return b;}
  private slot(catalog:any,data:any,rows:any[]){try{const slot=allocate(catalog,data,rows);return {...slot,date:localParts(slot.start,catalog.timeZone||'UTC').date,start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString()};}catch(error){throw new BadRequestException(error instanceof Error?error.message:'This time is unavailable');}}
  @Post('bookings/options') async bookingOptions(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog)return [];const date=String(data.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new BadRequestException('Choose a date');const rows=await this.db.businessRecord.findMany({where:{businessId:b.id,type:'bookings'},take:1000});const midnight=Date.parse(`${date}T00:00:00Z`),slots=[];for(let offset=-14*60;offset<38*60;offset+=15){const ms=midnight+offset*60000;if(localParts(ms,catalog.timeZone||'UTC').date!==date)continue;try{const slot=allocate(catalog,{...data,start:new Date(ms).toISOString()},rows.map(r=>r.data));slots.push({start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString()});}catch{}}return slots;}
  @Post('bookings') async createBooking(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog)throw new BadRequestException('Online booking is not configured');const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),startMs=Date.parse(String(data.start||''));if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Enter your name and a valid email');if(!Number.isFinite(startMs))throw new BadRequestException('Choose a valid date and time');return this.db.$transaction(async tx=>{const date=localParts(startMs,catalog.timeZone||'UTC').date;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${b.id}), hashtext(${date}))`;const rows=await tx.businessRecord.findMany({where:{businessId:b.id,type:'bookings'},take:1000});const slot=this.slot(catalog,data,rows.map(r=>r.data));const booking=await tx.businessRecord.create({data:{businessId:b.id,type:'bookings',status:'confirmed',data:{...slot,name,email,phone:String(data.phone||'').slice(0,40)} as any}});await tx.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:slot.kind,message:`New ${slot.kind}: ${name}`} as any}});return {id:booking.id,start:slot.start,end:slot.end,status:booking.status,timeZone:catalog.timeZone};});}
  @Post('inquiries') async inquiry(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),message=String(data.message||'').trim();if(!name||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Complete the required fields');let answers:Record<string,string>={};if(data.answers!==undefined){const formId=String(data.formId||'').slice(0,100),section=findPublishedContactForm(b.website?.published,formId);if(!section)throw new BadRequestException('This form is no longer available');try{answers=validatePublishedFormAnswers(section,data.answers);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Invalid form answers');}}const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'inquiries',status:'new',data:{name,email,message,formId:String(data.formId||'').slice(0,100),...(Object.keys(answers).length?{answers}: {})} as any}});await this.db.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:'inquiry',message:`New inquiry: ${name}`} as any}});return {id:row.id};}
  @Post('analytics/pageview') async pageview(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),settings=b.settings as any,catalog=settings.businessCatalog||settings.catalog;if(!catalog?.analyticsEnabled)return {recorded:false};const session=String(data.sessionId||'');if(!/^[a-zA-Z0-9-]{16,100}$/.test(session)||typeof data.page!=='string'||data.page.length>200)throw new BadRequestException('Invalid analytics event');const date=new Date().toISOString().slice(0,10),sessionKey=createHash('sha256').update(`${date}:${session}`).digest('hex'),page=String(data.page),source=(()=>{try{return new URL(String(data.referrer||'')).hostname.slice(0,150)||'direct';}catch{return 'direct';}})();const prior=await this.db.businessRecord.findFirst({where:{businessId:b.id,type:'pageViews',data:{path:['sessionKey'],equals:sessionKey}}});const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'pageViews',data:{sessionKey,date,page,source,uniqueVisit:!prior} as any}});return {recorded:!!row};}
  @Post('pickup-orders') async pickup(@Body() dto:JsonInput){const data=dto.data as any,b=await this.business(String(data.storeUrl||'')),catalog=(b.settings as any).businessCatalog;if(!catalog?.takeawayEnabled)throw new BadRequestException('Pickup orders are not enabled');const name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase();if(!name||!String(data.phone||'').trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Add your name, email and phone');const itemRows=Array.isArray(data.items)?data.items:[],menu=Array.isArray(catalog.menu)?catalog.menu:[],items=itemRows.map((item:any)=>{const p=menu.find((x:any)=>x.id===item.id&&x.active!==false),qty=Number(item.quantity);if(!p||!Number.isInteger(qty)||qty<1||qty>99)throw new BadRequestException('Invalid menu item');return {id:p.id,name:p.name,quantity:qty,price:Number(p.price)||0};});if(!items.length)throw new BadRequestException('Choose at least one item');const total=items.reduce((sum:any,item:any)=>sum+Math.round(item.price*100)*item.quantity,0);const row=await this.db.businessRecord.create({data:{businessId:b.id,type:'pickupOrders',status:'new',data:{name,email,phone:String(data.phone).slice(0,40),items,total,pickupAt:data.pickupAt,paymentStatus:'Pay at pickup'} as any}});await this.db.businessRecord.create({data:{businessId:b.id,type:'notifications',data:{type:'pickup',message:`New pickup order: ${name}`} as any}});return {id:row.id,total,status:row.status};}
}

@Controller('products')
@UseGuards(SessionGuard)
export class ProductController {
  constructor(private db:DbService){}
  private async business(req:Request & {user:any}){const b=await selectedBusiness(this.db,req);if(!b)throw new NotFoundException('Create a business first');return b;}
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.business(req);return this.db.product.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'}});}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req);const error=productDataValidationError(dto.data);if(error)throw new BadRequestException(error);const name=String(dto.data.name||'').trim();await assertOwnedMedia(this.db,req.user.id,dto.data);return this.db.product.create({data:{businessId:b.id,name,data:dto.data as any}});}
  @Put(':id') async update(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req);const id=String(req.params['id']);const prior=await this.db.product.findFirst({where:{id,businessId:b.id}});if(!prior)throw new NotFoundException('Product not found');await assertOwnedMedia(this.db,req.user.id,dto.data);const merged={...(prior.data as Record<string,unknown>),...dto.data};const error=productDataValidationError({...merged,name:dto.data.name??prior.name});if(error)throw new BadRequestException(error);const name=String(merged.name||prior.name).trim();const result=await this.db.product.updateMany({where:{id,businessId:b.id},data:{name,data:merged as any}});if(!result.count)throw new NotFoundException('Product not found');return this.db.product.findUnique({where:{id}});}
  @Post(':id/duplicate') async duplicate(@Req() req:Request & {user:any}){const b=await this.business(req);const id=String(req.params['id']);const prior=await this.db.product.findFirst({where:{id,businessId:b.id}});if(!prior)throw new NotFoundException('Product not found');const data={...(prior.data as Record<string,any>),name:`${prior.name} (copy)`,status:'hidden',sku:''};await assertOwnedMedia(this.db,req.user.id,data);return this.db.product.create({data:{businessId:b.id,name:data.name,data:data as any}});}
  @Patch(':id/archive') async archive(@Req() req:Request & {user:any}){const b=await this.business(req);const id=String(req.params['id']);const prior=await this.db.product.findFirst({where:{id,businessId:b.id}});if(!prior)throw new NotFoundException('Product not found');const data={...(prior.data as Record<string,unknown>),status:'archived',archivedAt:new Date().toISOString()};const result=await this.db.product.updateMany({where:{id,businessId:b.id},data:{data:data as any}});if(!result.count)throw new NotFoundException('Product not found');return {archived:true,id};}
  @Delete(':id') async remove(@Req() req:Request & {user:any}){const b=await this.business(req);const result=await this.db.product.deleteMany({where:{id:String(req.params['id']),businessId:b.id}});if(!result.count)throw new NotFoundException('Product not found');return {deleted:true};}
}

@Controller('public/products')
export class PublicProductController {
  constructor(private db:DbService){}
  @Get(':slug') async list(@Req() req:Request){
    const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!business?.website?.published)throw new NotFoundException('Website not found');
    const rows=await this.db.product.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:300});
    return rows.filter(row=>!['hidden','archived'].includes(String((row.data as any)?.status||''))).map(row=>{
      const data=row.data as Record<string,unknown>;
      return {id:row.id,storeUrl:business.slug,currency:String(((business.settings as any)?.commerceSettings?.currency)||(business.settings as any)?.currency||'USD'),name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,images:data.images,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category,stock:data.stock,media:data.media,variants:data.variants,sizes:data.sizes,colors:data.colors,sku:data.sku,legacyId:data.id};
    });
  }
  @Get('item/:id') async one(@Req() req:Request){const id=String(req.params['id']||'');const row=await this.db.product.findUnique({where:{id},include:{business:{include:{website:true}}}});if(!row||!row.business.website?.published||['hidden','archived'].includes(String((row.data as any)?.status||'')))throw new NotFoundException('Product not found');const data=row.data as Record<string,unknown>;return {id:row.id,storeUrl:row.business.slug,currency:String(((row.business.settings as any)?.commerceSettings?.currency)||(row.business.settings as any)?.currency||'USD'),name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,images:data.images,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category,stock:data.stock,media:data.media,variants:data.variants,sizes:data.sizes,colors:data.colors,sku:data.sku,legacyId:data.id};}
}

@Controller('customers')
@UseGuards(SessionGuard)
export class CustomerController {
  constructor(private db:DbService){}
  private async business(req:Request & {user:any}){const business=await selectedBusiness(this.db,req);if(!business)throw new NotFoundException('Business not found');return business;}
  @Get() async list(@Req() req:Request & {user:any}) {
    const business=await this.business(req),rows=await this.db.customer.findMany({where:{businessId:business.id},orderBy:{id:'desc'},take:500});
    const search=String(req.query.search||'').trim().toLowerCase(),status=String(req.query.status||'').toLowerCase();
    return rows.filter(row=>{const data=row.data as any;return (!status||String(data.status||'').toLowerCase()===status)&&(!search||[data.name,data.email,data.phone].some(value=>String(value||'').toLowerCase().includes(search)));}).map(row=>({id:row.id,...(row.data as Record<string,unknown>)}));
  }
  @Get(':id') async one(@Req() req:Request & {user:any}) {
    const business=await this.business(req),id=String(req.params['id']),customer=await this.db.customer.findFirst({where:{id,businessId:business.id}});
    if(!customer)throw new NotFoundException('Customer not found');
    const email=String((customer.data as any)?.email||'').trim().toLowerCase();
    const orders=email?(await this.db.order.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:500})).filter(row=>String((row.data as any)?.email||'').trim().toLowerCase()===email):[];
    return {id,...(customer.data as Record<string,unknown>),orders:orders.map(row=>{const data=publicOrderData(row.data),status=String((row.data as any)?.fulfillmentStatus||row.status);return {...data,id:row.id,status,paymentStatus:orderPaymentStatus(row.data as any,status),createdAt:row.createdAt};})};
  }
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){
    const business=await this.business(req);
    const email=String(dto.data.email||'').trim().toLowerCase();
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Enter a valid customer email');
    const customer=await this.db.customer.create({data:{businessId:business.id,data:{...dto.data,...(email?{email}:{}),status:dto.data.status||'Active',totalSpent:0,paidOrders:0,orders:0} as any}});
    await logCustomerActivity(this.db,business.id,customer.id,'created',{kind:'customer_created',summary:'Customer profile created'});
    return customer;
  }
  @Patch(':id/status') async updateStatus(@Req() req:Request & {user:any},@Body() dto:CustomerStatusInput){
    const status=String(dto.status||'').trim();
    if(!['New','Active','Inactive','VIP','Blocked'].includes(status))throw new BadRequestException('Invalid customer status');
    const business=await this.business(req),id=String(req.params['id']),customer=await this.db.customer.findFirst({where:{id,businessId:business.id}});
    if(!customer)throw new NotFoundException('Customer not found');
    const changed=(customer.data as any)?.status!==status,at=new Date().toISOString();
    const data={...(customer.data as Record<string,unknown>),status,...(changed?{statusUpdatedAt:at}:{})};
    const result=await this.db.customer.updateMany({where:{id,businessId:business.id},data:{data:data as any}});
    if(!result.count)throw new NotFoundException('Customer not found');
    if(changed)await logCustomerActivity(this.db,business.id,id,`status:${at}:${status}`,{kind:'customer_status_changed',summary:`Customer status changed to ${status}`,at});
    return {id,...data};
  }
  @Patch(':id/notes') async updateNotes(@Req() req:Request & {user:any},@Body() dto:JsonInput){
    const note=String(dto.data.note||'').trim();
    if(note.length>2000)throw new BadRequestException('Customer notes cannot exceed 2000 characters');
    const business=await this.business(req),id=String(req.params['id']),customer=await this.db.customer.findFirst({where:{id,businessId:business.id}});
    if(!customer)throw new NotFoundException('Customer not found');
    if(String((customer.data as any)?.notes||'')===note)return {id,notes:note,noteUpdatedAt:(customer.data as any)?.noteUpdatedAt||null};
    const at=new Date().toISOString(),data={...(customer.data as Record<string,any>),notes:note,noteUpdatedAt:at};
    const result=await this.db.customer.updateMany({where:{id,businessId:business.id},data:{data:data as any}});
    if(!result.count)throw new NotFoundException('Customer not found');
    await logCustomerActivity(this.db,business.id,id,`notes:${at}:${createHash('sha256').update(note).digest('hex').slice(0,16)}`,{kind:'customer_notes_updated',summary:'Customer notes updated',at});
    return {id,notes:note,noteUpdatedAt:data.noteUpdatedAt};
  }
  @Delete(':id') async remove(@Req() req:Request & {user:any}){
    const business=await this.business(req),result=await this.db.customer.deleteMany({where:{id:String(req.params['id']),businessId:business.id}});
    if(!result.count)throw new NotFoundException('Customer not found');
    return {deleted:true};
  }
}

@Controller('orders')
@UseGuards(SessionGuard)
export class OrderController {
  private stripeGateway=new StripeGatewayAdapter();
  constructor(private db:DbService){}
  private async business(req:Request & {user:any}){const business=await selectedBusiness(this.db,req);if(!business)throw new NotFoundException('Business not found');return business;}
  @Get() async list(@Req() req:Request & {user:any}) {
    const business=await this.business(req),rows=await this.db.order.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:500});
    const search=String(req.query.search||'').trim().toLowerCase(),status=String(req.query.status||'').toLowerCase(),payment=String(req.query.paymentStatus||'').toLowerCase();
    return rows.filter(row=>{
      const data=publicOrderData(row.data),fulfillment=String((row.data as any)?.fulfillmentStatus||row.status).toLowerCase(),paid=orderPaymentStatus(row.data as any,fulfillment).toLowerCase();
      const matchesSearch=!search||[row.id,data.customerName,data.email,data.phone,...(Array.isArray(data.items)?data.items.map((item:any)=>item.name):[])].some(value=>String(value||'').toLowerCase().includes(search));
      return matchesSearch&&(!status||fulfillment===status)&&(!payment||paid===payment);
    }).map(row=>{const data=publicOrderData(row.data);return {...row,data:{...data,paymentStatus:orderPaymentStatus(data,String(data.fulfillmentStatus||row.status))}};});
  }
  @Get(':id') async one(@Req() req:Request & {user:any}) {
    const business=await this.business(req),row=await this.db.order.findFirst({where:{id:String(req.params['id']),businessId:business.id}});
    if(!row)throw new NotFoundException('Order not found');
    const data=publicOrderData(row.data);
    const fulfillmentStatus=String(data.fulfillmentStatus||row.status);
    return {...data,id:row.id,status:fulfillmentStatus,paymentStatus:orderPaymentStatus(data,fulfillmentStatus),createdAt:row.createdAt};
  }
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput) {
    const business=await this.business(req),data=dto.data as Record<string,any>,amount=Number(data.total??data.amount);
    const fulfillmentStatus=String(data.fulfillmentStatus||data.status||'new').toLowerCase();
    return this.db.order.create({data:{businessId:business.id,status:fulfillmentStatus,amountCents:Number.isFinite(amount)?Math.round(amount*100):null,currency:String(data.currency||'USD'),data:{...data,fulfillmentStatus} as any}});
  }
  private async refreshCustomerTotals(tx:any,businessId:string,email:string) {
    if(!email)return;
    const customer=await tx.customer.findFirst({where:{businessId,data:{path:['email'],equals:email}}});
    if(!customer)return;
    const orders=await tx.order.findMany({where:{businessId}});
    const matching=orders.filter((row:any)=>String((row.data as any)?.email||'').trim().toLowerCase()===email);
    const paid=matching.filter((row:any)=>String((row.data as any)?.paymentStatus||'').toLowerCase()==='paid');
    const spentCents=paid.reduce((sum:number,row:any)=>sum+(Number((row.data as any)?.collectedAmountCents??row.amountCents??Math.round(Number((row.data as any)?.total||0)*100))||0),0);
    const refundedCents=paid.reduce((sum:number,row:any)=>sum+(Array.isArray((row.data as any)?.refundHistory)?(row.data as any).refundHistory.reduce((total:number,item:any)=>total+(Number(item.amountCents)||0),0):0),0);
    const customerData={...(customer.data as Record<string,any>),totalSpent:Math.max(0,spentCents-refundedCents)/100,paidOrders:paid.length,orders:matching.length,lastOrder:matching[0]?.createdAt?.toISOString?.()||(customer.data as any)?.lastOrder};
    await tx.customer.update({where:{id:customer.id},data:{data:customerData as any}});
  }
  private async restoreInventory(tx:any,businessId:string,orderData:Record<string,any>) {
    const items=Array.isArray(orderData.items)?orderData.items:[];
    const groups=new Map<string,any[]>();
    for(const item of items){const id=String(item.id||item.productId||'');if(!id)continue;groups.set(id,[...(groups.get(id)||[]),item]);}
    for(const [productId,lines] of groups){
      const current=await tx.product.findFirst({where:{id:productId,businessId}});
      if(!current)continue;
      const original=current.data as Record<string,any>,next:any={...original};let changed=false;
      for(const line of lines){
        const quantity=Number(line.quantity);if(!Number.isInteger(quantity)||quantity<1)continue;
        const variantId=String(line.variantId||'');
        if(variantId&&Array.isArray(next.variants)){
          const variants=[...next.variants],index=variants.findIndex((value:any)=>String(value?.id||value?.sku||value?.name||'')===variantId);
          if(index<0)throw new ConflictException('The ordered product variant no longer exists. Inventory was not released.');
          const variant={...variants[index]};
          if(variant.stock!==undefined&&variant.stock!==null&&String(variant.stock).trim()!==''){
            const stock=Number(variant.stock);
            if(!Number.isInteger(stock)||stock<0)throw new ConflictException('The ordered product variant has invalid stock. Inventory was not released.');
            variant.stock=stock+quantity;variants[index]=variant;next.variants=variants;changed=true;
          }else if(next.stock!==undefined&&next.stock!==null&&String(next.stock).trim()!==''){
            const stock=Number(next.stock);
            if(!Number.isInteger(stock)||stock<0)throw new ConflictException('The product has invalid stock. Inventory was not released.');
            next.stock=stock+quantity;changed=true;
          }
        }else if(next.stock!==undefined&&next.stock!==null&&String(next.stock).trim()!==''){
          const stock=Number(next.stock);
          if(!Number.isInteger(stock)||stock<0)throw new ConflictException('The product has invalid stock. Inventory was not released.');
          next.stock=stock+quantity;changed=true;
        }
      }
      if(changed){
        // Keep the parent quantity aligned when each product option has its own
        // tracked inventory. Blank option stock uses the parent as a shared
        // fallback and must not be included in this total.
        if(Array.isArray(next.variants)&&next.variants.length&&next.variants.every((variant:any)=>variant?.stock!==undefined&&variant?.stock!==null&&String(variant.stock).trim()!==''&&Number.isInteger(Number(variant.stock))&&Number(variant.stock)>=0)){
          next.stock=next.variants.reduce((total:number,variant:any)=>total+Number(variant.stock),0);
        }
        const restored=await tx.product.updateMany({where:{id:productId,businessId,data:{equals:original as any}},data:{data:next as any}});
        if(restored.count!==1)throw new ConflictException('Inventory changed while the order was being cancelled. Retry the update.');
      }
    }
  }
  private async setPaymentStatus(req:Request & {user:any},id:string,status:'paid'|'refunded') {
    const business=await this.business(req);
    return this.db.$transaction(async tx=>{
      const current=await tx.order.findFirst({where:{id,businessId:business.id}});
      if(!current)throw new NotFoundException('Order not found');
      const data={...(current.data as Record<string,any>)},prior=String(data.paymentStatus||'Pending').toLowerCase();
      if(status==='paid'&&(['cancelled','returned'].includes(String(data.fulfillmentStatus||'').toLowerCase())||['cancelled','returned'].includes(String(current.status||'').toLowerCase())))throw new ConflictException('A cancelled or returned order cannot be marked paid.');
      if(data.gatewayProvider==='tap')throw new ConflictException('Tap payments can only be marked paid or refunded after Tap confirms the transaction. Use the provider refund action for refunds.');
      if(status==='paid'&&prior==='paid'){
        if(['bank_transfer','external_payment_link'].includes(String(data.manualPaymentProvider||''))&&tx.businessRecord?.updateMany){const now=new Date().toISOString();await tx.businessRecord.updateMany({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}},data:{status:'confirmed',data:{provider:data.manualPaymentProvider,orderId:id,amountCents:data.collectedAmountCents??current.amountCents,currency:current.currency,reference:data.manualPaymentReference,status:'confirmed',confirmedAt:data.paidAt||now}}});}
        return current;
      }
      if(status==='refunded'&&prior==='refunded')return current;
      if(status==='paid'&&prior==='refunded')throw new ConflictException('A refunded order cannot be marked paid again without a new collection record.');
      if(status==='refunded'&&prior!=='paid')throw new BadRequestException('Only a collected payment can be refunded.');
      const now=new Date().toISOString(),history=Array.isArray(data.paymentHistory)?data.paymentHistory:[];
      if(status==='paid'){
        data.paymentStatus='Paid';data.paidAt=now;
        data.collectedAmountCents=current.amountCents??Math.round(Number(data.total||0)*100);
        data.paymentHistory=[...history,{type:'collected',amountCents:data.collectedAmountCents,recordedAt:now,method:data.paymentMethod||'cash'}];
      }else{
        data.paymentStatus='Refunded';
        const refunds=Array.isArray(data.refundHistory)?data.refundHistory:[];
        data.refundHistory=[...refunds,{amountCents:Number(data.collectedAmountCents||current.amountCents||0),recordedAt:now,status:'recorded'}];
        data.paymentHistory=[...history,{type:'refund',amountCents:Number(data.collectedAmountCents||current.amountCents||0),recordedAt:now}];
      }
      const updated=await tx.order.updateMany({where:{id,businessId:business.id,status:current.status,data:{equals:current.data as any}},data:{data:data as any}});
      if(updated.count!==1)throw new ConflictException('Order changed while the payment update was being saved. Reload and try again.');
      await this.refreshCustomerTotals(tx,business.id,String(data.email||'').trim().toLowerCase());
      if(status==='paid'&&['bank_transfer','external_payment_link'].includes(String(data.manualPaymentProvider||''))&&tx.businessRecord?.updateMany){
        await tx.businessRecord.updateMany({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}},data:{status:'confirmed',data:{provider:data.manualPaymentProvider,orderId:id,amountCents:data.collectedAmountCents,currency:current.currency,reference:data.manualPaymentReference,status:'confirmed',confirmedAt:now}}});
      }
      return tx.order.findUnique({where:{id}});
    });
  }
  private async setFulfillment(req:Request & {user:any},id:string,input:Record<string,any>) {
    const status=String(input.status||'').toLowerCase();
    const valid=['new','processing','packed','shipped','delivered','cancelled','returned'];
    if(!valid.includes(status))throw new BadRequestException('Invalid fulfillment status');
    const business=await this.business(req);
    if(status==='cancelled'){
      const attempt=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}}}),attemptData=attempt?.data as any;
      if(attempt&&attemptData?.provider==='stripe'&&attemptData?.stripePaymentIntentId&&!['failed','FAILED','canceled','CANCELED','cancelled','succeeded','SUCCEEDED'].includes(String(attempt.status||''))){
        const credential=await this.db.businessRecord.findFirst({where:{legacyFirebasePath:`payment-provider:${business.id}:stripe`,businessId:business.id,type:'merchantPaymentProvider',status:{in:['connected','disconnected']}}}),encrypted=credential?.data as any;
        if(!encrypted||encrypted.provider!=='stripe'||encrypted.mode!=='test')throw new ConflictException('Stripe test credentials are unavailable to cancel the pending payment.');
        let secret='';try{secret=String(JSON.parse(decryptMerchantPaymentSecret(encrypted)).restrictedTestKey||'');}catch{throw new ConflictException('Stripe test credentials could not be decrypted to cancel the pending payment.');}
        const currentIntent=await this.stripeGateway.retrievePayment(secret,String(attemptData.stripePaymentIntentId));
        if(currentIntent.status==='succeeded')throw new ConflictException('This Stripe payment has already succeeded. Refund it before cancelling the order.');
        if(!['canceled','requires_payment_method','requires_confirmation','requires_action','requires_capture'].includes(String(currentIntent.status)))throw new ConflictException('Stripe is still processing this payment. Wait for its final status before cancelling the order.');
        if(currentIntent.status!=='canceled')await this.stripeGateway.cancelPayment(secret,String(attemptData.stripePaymentIntentId),`cyb-cancel-${createHash('sha256').update(`${business.id}:${id}`).digest('hex').slice(0,40)}`);
        await this.db.businessRecord.update({where:{id:attempt.id},data:{status:'CANCELED',data:{...attemptData,status:'canceled',cancelledAt:new Date().toISOString()}}});
      }
    }
    const trackingNumber=input.trackingNumber===undefined?undefined:String(input.trackingNumber||'').trim();
    const carrier=input.carrier===undefined?undefined:String(input.carrier||'').trim();
    let trackingUrl=input.trackingUrl===undefined?undefined:String(input.trackingUrl||'').trim();
    if(trackingNumber&&trackingNumber.length>120)throw new BadRequestException('Tracking number is too long');
    if(carrier&&carrier.length>80)throw new BadRequestException('Carrier name is too long');
    if(trackingUrl){try{const url=new URL(trackingUrl);if(url.protocol!=='https:')throw new Error();}catch{throw new BadRequestException('Tracking URL must be a valid HTTPS URL');}}
    return this.db.$transaction(async tx=>{
      const current=await tx.order.findFirst({where:{id,businessId:business.id}});
      if(!current)throw new NotFoundException('Order not found');
      const data={...(current.data as Record<string,any>)},prior=String(data.fulfillmentStatus||current.status||'new').toLowerCase();
      if(['cancelled','returned'].includes(status)){
        if(data.gatewayProvider==='tap'&&String(data.paymentStatus||'').toLowerCase()==='paid')throw new ConflictException('Refund the Tap payment before cancelling or returning this paid order.');
        if(String(data.paymentStatus||'').toLowerCase()==='paid')throw new ConflictException('Refund the collected payment before cancelling or returning this paid order.');
        if(!(data.gatewayProvider==='tap'&&String(data.paymentStatus||'').toLowerCase()==='refunded')&&tx.businessRecord?.findFirst){const attempt=await tx.businessRecord.findFirst({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}}});const attemptData=attempt?.data as any;const isTapAttempt=attemptData?.provider==='tap'||!!attemptData?.tapChargeId;if(isTapAttempt&&!['failed','DECLINED','FAILED','CANCELLED','EXPIRED','REFUNDED'].includes(String(attempt?.status||'')))throw new ConflictException('A Tap payment is still in progress. Wait for Tap to confirm or fail it before cancelling this order.');}
      }
      if(prior===status&&trackingNumber===undefined&&carrier===undefined&&trackingUrl===undefined)return current;
      const transitions:Record<string,string[]>={new:['processing','cancelled'],pending:['processing','cancelled'],processing:['packed','cancelled'],packed:['shipped','cancelled'],shipped:['delivered','returned'],delivered:['returned'],cancelled:[],returned:[]};
      if(prior!==status&&!(transitions[prior]||[]).includes(status))throw new ConflictException(`Cannot move fulfillment from ${prior} to ${status}.`);
      const now=new Date().toISOString(),timeline=Array.isArray(data.timeline)?data.timeline:[];
      if(prior!==status){
        if(status==='cancelled'||status==='returned'){
          if(!data.inventoryRestoredAt){await this.restoreInventory(tx,business.id,data);data.inventoryRestoredAt=now;data.inventoryHistory=[...(Array.isArray(data.inventoryHistory)?data.inventoryHistory:[]),{type:'released',recordedAt:now,reason:status}];}
          if(status==='cancelled'&&['bank_transfer','external_payment_link'].includes(String(data.manualPaymentProvider||''))&&String(data.paymentStatus||'').toLowerCase()==='awaiting manual confirmation')data.paymentStatus='Cancelled';
        }
        data.fulfillmentStatus=status;
        data.timeline=[...timeline,{type:'fulfillment',status,recordedAt:now}];
      }
      if(trackingNumber!==undefined)data.trackingNumber=trackingNumber||null;
      if(carrier!==undefined)data.shippingCarrier=carrier||null;
      if(trackingUrl!==undefined)data.trackingUrl=trackingUrl||null;
      const updated=await tx.order.updateMany({where:{id,businessId:business.id,status:current.status,data:{equals:current.data as any}},data:{status,data:data as any}});
      if(updated.count!==1)throw new ConflictException('Order changed while fulfillment was being updated. Reload and try again.');
      if(status==='cancelled'&&['bank_transfer','external_payment_link'].includes(String(data.manualPaymentProvider||''))&&tx.businessRecord?.updateMany){
        const manualPayment=await tx.businessRecord.findFirst?.({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}}});
        const paymentData=manualPayment?.data as any;
        if(manualPayment?.status==='awaiting_confirmation'&&['bank_transfer','external_payment_link'].includes(String(paymentData?.provider||''))){
          await tx.businessRecord.updateMany({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:id}},data:{status:'cancelled',data:{...paymentData,status:'cancelled',cancelledAt:now}}});
        }
      }
      return tx.order.findUnique({where:{id}});
    });
  }
  @Patch(':id/status') async updateStatus(@Req() req:Request & {user:any},@Body() dto:OrderStatusInput){
    const status=dto.status.toLowerCase(),id=String(req.params['id']);
    if(status==='paid'||status==='refunded')return this.setPaymentStatus(req,id,status);
    return this.setFulfillment(req,id,{status});
  }
  @Patch(':id/payment') async updatePayment(@Req() req:Request & {user:any},@Body() dto:JsonInput){
    const status=String(dto.data.status||'').toLowerCase();
    if(status!=='paid'&&status!=='refunded')throw new BadRequestException('Invalid payment status');
    return this.setPaymentStatus(req,String(req.params['id']),status);
  }
  @Patch(':id/fulfillment') async updateFulfillment(@Req() req:Request & {user:any},@Body() dto:JsonInput){
    return this.setFulfillment(req,String(req.params['id']),dto.data);
  }
  @Patch(':id') async updateDetails(@Req() req:Request & {user:any},@Body() dto:JsonInput){
    const business=await this.business(req),id=String(req.params['id']);
    const row=await this.db.order.findFirst({where:{id,businessId:business.id}});
    if(!row)throw new NotFoundException('Order not found');
    const allowed=['notes','shippingAddress','customerPhone'];
    const patch=Object.fromEntries(Object.entries(dto.data).filter(([key])=>allowed.includes(key)));
    const data={...(row.data as Record<string,unknown>),...patch};
    const updated=await this.db.order.updateMany({where:{id,businessId:business.id,status:row.status,data:{equals:row.data as any}},data:{data:data as any}});
    if(!updated.count)throw new ConflictException('Order changed. Reload and try again.');
    return this.one(req);
  }
  @Delete(':id') async remove(@Req() req:Request & {user:any}){
    const business=await this.business(req),id=String(req.params['id']);
    const row=await this.db.order.findFirst({where:{id,businessId:business.id}});
    if(!row)throw new NotFoundException('Order not found');
    if(['paid','refunded'].includes(String((row.data as any)?.paymentStatus||'').toLowerCase()))throw new ConflictException('Orders with financial history cannot be deleted.');
    const result=await this.db.order.deleteMany({where:{id,businessId:business.id,status:row.status}});
    if(!result.count)throw new ConflictException('Order changed. Reload and try again.');
    return {deleted:true};
  }
}

// Customer checkout is intentionally public. The order is attached to a published
// business by its public slug; private order reads remain owner-scoped above.
function publicOrderData(value: unknown): Record<string, unknown> {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const { customerActionTokenHash: _privateTokenHash, checkoutRequestHash: _privateCheckoutHash, ...publicData } = data;
  return publicData;
}

function checkoutRequestHash(data:Record<string,any>,storeSlug:string) {
  const stable={
    storeSlug,
    customerName:String(data.customerName||'').trim().slice(0,160),
    email:String(data.email||'').trim().toLowerCase().slice(0,254),
    phone:String(data.phone||'').trim().slice(0,40),
    address:String(data.address||'').trim().slice(0,300),
    city:String(data.city||'').trim().slice(0,120),
    countryCode:String(data.countryCode||'').trim().toUpperCase().slice(0,3),
    deliveryMethod:String(data.deliveryMethod||'delivery').trim().toLowerCase().slice(0,30),
    discountCode:String(data.discountCode||'').trim().toUpperCase().slice(0,80),
    notes:String(data.notes||'').trim().slice(0,1000),
    items:(Array.isArray(data.items)?data.items:[]).map(item=>({
      productId:String(item?.id||item?.productId||'').slice(0,120),
      variantId:String(item?.variantId||item?.variant?.id||'').slice(0,120),
      quantity:Number(item?.quantity),
    })),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
function checkoutOrderId(businessId:string,idempotencyKey:string) {
  return `checkout_${createHash('sha256').update(`${businessId}:${idempotencyKey}`).digest('hex').slice(0,48)}`;
}

function authoritativeProductPrice(productData: Record<string, unknown>) {
  const salePrice = productData.salePrice;
  const raw = salePrice !== undefined && salePrice !== null && String(salePrice).trim() !== ''
    ? salePrice
    : productData.sellingPrice ?? productData.price ?? 0;
  return Number(raw);
}

@Controller('public/orders')
export class PublicOrderController {
  constructor(private db:DbService){}
  @Post() async create(@Body() dto:CheckoutOrderInput){const data=dto.data as Record<string,any>,idempotencyKey=String(dto.idempotencyKey||'').trim(),customerActionToken=String(dto.customerActionToken||'').trim();if(!/^[A-Za-z0-9_-]{32,128}$/.test(idempotencyKey)||!/^[A-Za-z0-9_-]{32,128}$/.test(customerActionToken))throw new BadRequestException('Valid checkout security tokens are required');const slug=String(data.storeUrl||'');const business=await this.db.business.findUnique({where:{slug},include:{website:true}});if(!business?.website?.published)throw new NotFoundException('Store not found');const requestHash=checkoutRequestHash(data,slug),id=checkoutOrderId(business.id,idempotencyKey);const prior=await this.db.order?.findUnique?.({where:{id}});if(prior){if((prior.data as any)?.checkoutRequestHash!==requestHash||(prior.data as any)?.customerActionTokenHash!==tokenHash(customerActionToken))throw new ConflictException('This checkout key was already used for a different order. Refresh checkout and try again.');return {...publicOrderData(prior.data),id:prior.id,status:prior.status,createdAt:prior.createdAt,cashOnDeliveryToken:customerActionToken};}const name=String(data.customerName||'').trim(),email=String(data.email||'').trim().toLowerCase();if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Enter a valid customer name and email');const cart=Array.isArray(data.items)?data.items:[];if(!cart.length||cart.length>100)throw new BadRequestException('Invalid order items');const products=await this.db.product.findMany({where:{businessId:business.id}});const items=cart.map(item=>{const product=products.find(p=>p.id===String(item.id||item.productId||'')),quantity=Number(item.quantity);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>99||['hidden','archived'].includes(String((product.data as any)?.status||'')))throw new BadRequestException('A product in this order is unavailable');const productData=product.data as Record<string,any>,variants=Array.isArray(productData.variants)?productData.variants:[];const requestedVariant=String(item.variantId||item.variant?.id||'');let variant:any=null;if(variants.length){variant=variants.find(value=>String(value?.id||value?.sku||value?.name||'')===requestedVariant);if(!variant)throw new BadRequestException('Choose an available product variant');}const pricingData=variant?{...productData,...variant}:productData;const price=authoritativeProductPrice(pricingData);if(!Number.isFinite(price)||price<0)throw new BadRequestException('Invalid product price');const stock=variant?.stock??productData.stock;if(stock!==undefined&&stock!==null&&String(stock).trim()!==''&&(!Number.isInteger(Number(stock))||Number(stock)<quantity))throw new BadRequestException('A product in this order is out of stock');return {...item,id:product.id,name:product.name,price,quantity,...(variant?{variantId:String(variant.id||variant.sku||variant.name),variantName:String(variant.name||variant.label||variant.sku||'Variant'),sku:variant.sku||productData.sku}:{} )};});const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0),storeSettings=(business.settings||{}) as Record<string,any>,commerce={...(storeSettings.commerceSettings||{}),currency:storeSettings.commerceSettings?.currency||storeSettings.currency||'USD'};let order:any;try{order=await this.db.$transaction(async tx=>{
  const byProduct=new Map<string,any[]>();
  for(const item of items){const list=byProduct.get(item.id)||[];list.push(item);byProduct.set(item.id,list);}
  for(const [productId,lines] of byProduct){
    const snapshot=products.find(product=>product.id===productId);
    const snapshotData=(snapshot?.data||{}) as Record<string,any>;
    const variantsTracked=Array.isArray(snapshotData.variants)&&snapshotData.variants.some((value:any)=>value?.stock!==undefined&&value?.stock!==null&&String(value.stock).trim()!=='');
    if((snapshotData.stock===undefined||snapshotData.stock===null||String(snapshotData.stock).trim()==='')&&!variantsTracked)continue;
    const current=await tx.product.findFirst({where:{id:productId,businessId:business.id}});
    if(!current)throw new ConflictException('A product changed while checkout was being completed. Refresh your cart and try again.');
    const original=current.data as Record<string,any>,next:any={...original};
    let tracked=false;
    for(const line of lines){
      const selectedId=String(line.variantId||'');
      if(selectedId){
        const variants=Array.isArray(next.variants)?[...next.variants]:[];
        const index=variants.findIndex((value:any)=>String(value?.id||value?.sku||value?.name||'')===selectedId);
        if(index<0)throw new ConflictException('A selected product variant is no longer available.');
        const variant={...variants[index]},stock=variant.stock??next.stock;
        if(stock!==undefined&&stock!==null&&String(stock).trim()!==''){
          const available=Number(stock);
          if(!Number.isInteger(available)||available<line.quantity)throw new ConflictException('A product in this order is out of stock.');
          if(variant.stock!==undefined&&variant.stock!==null&&String(variant.stock).trim()!=='')variant.stock=available-line.quantity;
          else next.stock=available-line.quantity;
          variants[index]=variant;tracked=true;
        }
        next.variants=variants;
      }else if(next.stock!==undefined&&next.stock!==null&&String(next.stock).trim()!==''){
        const available=Number(next.stock);
        if(!Number.isInteger(available)||available<line.quantity)throw new ConflictException('A product in this order is out of stock.');
        next.stock=available-line.quantity;tracked=true;
      }
    }
    // Variant stock is the source of truth when every option tracks stock.
    // Persist the aggregate parent quantity in the same compare-and-swap write.
    if(tracked&&Array.isArray(next.variants)&&next.variants.length&&next.variants.every((variant:any)=>variant?.stock!==undefined&&variant?.stock!==null&&String(variant.stock).trim()!=='')){
      next.stock=next.variants.reduce((total:number,variant:any)=>total+Number(variant.stock),0);
    }
    if(tracked){
      const reserved=await tx.product.updateMany({where:{id:productId,businessId:business.id,data:{equals:original as any}},data:{data:next as any}});
      if(reserved.count!==1)throw new ConflictException('Inventory changed during checkout. Refresh your cart and try again.');
    }
  }
  const requestedCode=String(data.discountCode||'').trim().toUpperCase();
  let discountUses=0;
  if(requestedCode){
    const priorOrders=await tx.order.findMany({where:{businessId:business.id}});
    discountUses=priorOrders.filter(row=>String((row.data as any)?.discountCode||'').toUpperCase()===requestedCode&&!['cancelled','refunded'].includes(row.status)).length;
  }
  let totals:any;
  try{totals=calculateStoreOrderTotals(commerce,subtotal,{countryCode:String(data.countryCode||''),deliveryMethod:String(data.deliveryMethod||'delivery'),discountCode:requestedCode,discountUses});}
  catch(error){throw new BadRequestException(error instanceof Error?error.message:'Checkout settings are invalid');}
  // Never accept lifecycle or accounting fields from the public checkout.
  // In particular, a client supplied restoration marker could otherwise make
  // a later cancellation skip the inventory release step.
  const {
    inventoryRestoredAt: _clientInventoryRestoredAt,
    inventoryHistory: _clientInventoryHistory,
    paymentHistory: _clientPaymentHistory,
    refundHistory: _clientRefundHistory,
    collectedAmountCents: _clientCollectedAmountCents,
    paidAt: _clientPaidAt,
    refundedAt: _clientRefundedAt,
    fulfillmentStatus: _clientFulfillmentStatus,
    ...checkoutData
  }=data;
  const normalized={...checkoutData,items,subtotal:totals.subtotal,shipping:totals.shipping,discount:totals.discount,tax:totals.tax,taxLabel:totals.taxLabel,total:totals.total,currency:totals.currency,discountCode:totals.discountCode,status:'New',fulfillmentStatus:'new',paymentStatus:'Pending',createdAt:new Date().toISOString(),customerActionTokenHash:tokenHash(customerActionToken),checkoutRequestHash:requestHash};
  const amount=totals.total;
  const created=await tx.order.create({data:{id,businessId:business.id,status:'new',amountCents:Math.round(amount*100),currency:totals.currency,data:normalized as any}});const priorCustomer=await tx.customer.findFirst({where:{businessId:business.id,data:{path:['email'],equals:email}}});const customerData={name,email,phone:String(data.phone||''),storeUrl:slug,status:'Active',lastOrder:new Date().toISOString(),orders:Number((priorCustomer?.data as any)?.orders||0)+1,totalSpent:Number((priorCustomer?.data as any)?.totalSpent||0),paidOrders:Number((priorCustomer?.data as any)?.paidOrders||0)};if(priorCustomer)await tx.customer.update({where:{id:priorCustomer.id},data:{data:customerData as any}});else await tx.customer.create({data:{businessId:business.id,data:customerData as any}});return created;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(error){const existing=await this.db.order?.findUnique?.({where:{id}});if(!existing||(existing.data as any)?.checkoutRequestHash!==requestHash||(existing.data as any)?.customerActionTokenHash!==tokenHash(customerActionToken))throw error;order=existing;}return {...publicOrderData(order.data),id:order.id,status:order.status,createdAt:order.createdAt,cashOnDeliveryToken:customerActionToken};}
  @Get(':id') async customerTracking(@Req() req:Request){
    const id=String(req.params['id']||''),token=String(req.query.token||''),row=await this.db.order.findUnique({where:{id}});
    const storedHash=(row?.data as any)?.customerActionTokenHash;
    if(!row||typeof storedHash!=='string'||!/^[a-f0-9]{64}$/i.test(storedHash)||!token||!timingSafeEqual(Buffer.from(tokenHash(token),'hex'),Buffer.from(storedHash,'hex')))throw new NotFoundException('Order not found');
    const data=row.data as Record<string,any>;
    const fulfillmentStatus=data.fulfillmentStatus||row.status;
    return {id:row.id,status:fulfillmentStatus,fulfillmentStatus,paymentStatus:orderPaymentStatus(data,fulfillmentStatus),trackingNumber:data.trackingNumber||null,shippingCarrier:data.shippingCarrier||null,trackingUrl:data.trackingUrl||null,timeline:Array.isArray(data.timeline)?data.timeline:[],items:Array.isArray(data.items)?data.items.map((item:any)=>({name:item.name,quantity:item.quantity,variantName:item.variantName})):[],total:data.total,currency:data.currency,createdAt:row.createdAt};
  }
  @Post(':id/cash-on-delivery') async setCashOnDelivery(@Req() req:Request,@Body() dto:TokenInput){
    const id=String(req.params['id']),row=await this.db.order.findUnique({where:{id}}),storedHash=(row?.data as any)?.customerActionTokenHash;
    if(!row||row.status!=='new'||typeof storedHash!=='string'||!/^[a-f0-9]{64}$/i.test(storedHash)||!timingSafeEqual(Buffer.from(tokenHash(dto.token),'hex'),Buffer.from(storedHash,'hex')))throw new NotFoundException('Order not found');
    const current=row.data as Record<string,any>,payment=String(current.paymentStatus||'Pending').toLowerCase();
    if(payment==='cash on delivery')return {ok:true};
    if(payment==='paid'||payment==='refunded')throw new NotFoundException('Order not found');
    const paymentAttempt=await this.db.businessRecord?.findFirst?.({where:{businessId:row.businessId,type:'merchantPayment',data:{path:['orderId'],equals:id}}});
    if(paymentAttempt&&!['failed','DECLINED','FAILED','CANCELLED','EXPIRED'].includes(String(paymentAttempt.status||'')))throw new ConflictException('A card payment is still in progress. Wait for Tap to confirm or fail it before selecting cash on delivery.');
    const now=new Date().toISOString(),timeline=Array.isArray(current.timeline)?current.timeline:[];
    const data={...current,fulfillmentStatus:current.fulfillmentStatus||'new',paymentMethod:'cash',paymentStatus:'Cash on delivery',completedAt:now,timeline:[...timeline,{type:'payment-method',status:'Cash on delivery',recordedAt:now}]};
    const result=await this.db.order.updateMany({where:{id,status:'new',data:{equals:row.data as any}},data:{data:data as any}});
    if(!result.count){const latest=await this.db.order.findUnique({where:{id}});if(String((latest?.data as any)?.paymentStatus||'').toLowerCase()==='cash on delivery')return {ok:true};throw new NotFoundException('Order not found');}
    return {ok:true};
  }
}

function deterministicTrialWebsite(prompt:string){
  const clean=prompt.trim().replace(/\s+/g,' ').slice(0,1200),lower=clean.toLowerCase();
  const kind=/\b(consult(?:ing|ant)?|advisory|advisor|consultant|strategy)\b/.test(lower)?'consulting':/\b(portfolio|creative|designer|photographer|illustrator|artist)\b/.test(lower)?'portfolio':lower.includes('skin')||lower.includes('beauty')?'skincare':lower.includes('coffee')||lower.includes('cafe')?'coffee':lower.includes('fashion')||lower.includes('clothing')?'fashion':lower.includes('fitness')||lower.includes('gym')?'wellness':'studio';
  const profiles:Record<string,any>={
    skincare:{name:'ATELIER BOTANIQUE',eyebrow:'SKINCARE · MADE WITH INTENTION',title:'A softer ritual. A brighter kind of care.',body:'Thoughtful formulas and everyday rituals, created to make caring for your skin feel beautifully simple.',accent:'#9b765a',image:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=85',offer:'The daily ritual',items:['Gentle by design','Made for everyday','Care that feels considered']},
    coffee:{name:'SUNDAY ROAST',eyebrow:'SMALL BATCH · SLOW MORNINGS',title:'Make room for a better cup.',body:'Carefully sourced coffee, roasted in small batches and made for the moments worth slowing down for.',accent:'#76543d',image:'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=85',offer:'From our roastery',items:['Thoughtful sourcing','Roasted in small batches','A ritual worth keeping']},
    fashion:{name:'FORME STUDIO',eyebrow:'CONSIDERED WARDROBE · EST. 2026',title:'Fewer pieces. More ways to be you.',body:'A considered collection of modern essentials, made to move with you and stay in your wardrobe for years.',accent:'#7c6653',image:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85',offer:'The essentials edit',items:['Easy, timeless silhouettes','Designed for repeat wear','A quieter kind of statement']},
    wellness:{name:'STILL FORM',eyebrow:'MOVEMENT · WELLNESS · BALANCE',title:'Find your own kind of strong.',body:'A welcoming space to move with purpose, build a lasting practice and feel more at home in your body.',accent:'#547060',image:'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=85',offer:'Move at your pace',items:['Classes for every level','Guidance that meets you here','Progress without pressure']},
    studio:{name:'FORM & FIELD',eyebrow:'INDEPENDENT BUSINESS · MADE PERSONAL',title:'Good work deserves a beautiful home.',body:'A clear, considered introduction to your business, your approach and the work you are proud to share.',accent:'#776b5e',image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85',offer:'A little about us',items:['Thoughtful, personal service','Made around what matters','Here to help you begin'],cta:'Explore our approach',offerType:'services',offerTitle:'A clearer way to introduce your work',offerBody:'Show people what you do, how you work, and the best way to take the next step.',offerItems:['What you offer','How you work','How to get in touch']},
    consulting:{name:'NORTHLINE ADVISORY',eyebrow:'CONSULTING · PRACTICAL CLARITY',title:'Make your next move with confidence.',body:'Clear, thoughtful advice for businesses working through an important decision or a new stage of growth.',accent:'#667268',image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85',offer:'A more considered way forward',items:['Understand what matters most','Turn questions into clear next steps','Move forward with a trusted perspective'],cta:'Explore our approach',valuesTitle:'Clear thinking. Practical next steps.',offerType:'services',offerTitle:'A practical path forward',offerBody:'Introduce the areas you support and help people understand where to begin.',offerItems:['Strategy and planning','Operations and growth','Workshops and facilitation']},
    portfolio:{name:'STUDIO MARGINALIA',eyebrow:'SELECTED WORK · CREATIVE PRACTICE',title:'A considered home for your creative work.',body:'Bring selected projects, process, and the ideas behind your practice together in one clear portfolio.',accent:'#8b7159',image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85',offer:'A practice, told through its work',items:['Projects with a point of view','Process and perspective','A direct way to enquire'],cta:'Explore the work',valuesTitle:'Selected work. Thoughtfully presented.',offerType:'services',offerTitle:'What your portfolio can show',offerBody:'Make space for the projects and context you choose to share when you make this design your own.',offerItems:['Selected projects','Process and point of view','Contact and availability']}
  };
  const p=profiles[kind];
  const explicitBrand = clean.match(/(?:\bbrand\s+name\s+(?:(?:is|called|named|:|=)\s+)?|\bbrand\s+(?:is|called|named|:|=)\s+|\b(?:called|named)\s+)[“"']?([\p{L}][\p{L}\p{N} &'’-]{1,48})/iu)?.[1];
  const titledBusiness = clean.match(/\bfor\s+([\p{Lu}][\p{L}\p{N}&'’-]*(?:\s+[\p{Lu}][\p{L}\p{N}&'’-]*){0,3})/u)?.[1];
  const requested=(explicitBrand||titledBusiness)?.trim().replace(/[“"'.,!?]+$/g,'').replace(/\s+(with|that|and|featuring|using|selling|offering)\s+.*$/i,'').slice(0,32);
  const brandName=requested||p.name;
  const sections=[
    {id:'preview-hero',type:'hero',variant:'luxury',eyebrow:p.eyebrow,title:p.title,body:p.body,buttonText:p.cta||'Explore the collection',href:'#preview-offer',image:p.image,alt:`Editorial ${kind} preview`},
    {id:'preview-intro',type:'about',eyebrow:'A MORE PERSONAL APPROACH',title:p.offer,body:p.body,image:p.image,alt:`${kind} studio`},
    {id:'preview-values',type:'services',title:p.valuesTitle||'Made to feel like you.',body:'A few things that guide everything we do.',items:p.items},
    p.offerType==='services'
      ? {id:'preview-offer',type:'services',title:p.offerTitle,body:p.offerBody,items:p.offerItems}
      : {id:'preview-offer',type:'collection',title:'The thoughtful edit',body:'A preview of how your offer can come to life. Add your real products and details when you make your website yours.',limit:3},
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
  private async businessFor(req:Request & {user:any}){const business=await selectedBusiness(this.db,req);if(!business)throw new NotFoundException('Create a business first');return business;}
  private async requirePaidPublishing(user:{id:string;email:string}){
    const access=await this.db.subscription.findUnique({where:{userId:user.id}});
    if(access?.status==='ACTIVE'&&access.billingType==='ONE_TIME')return;
    if(hasStagingTestPublishingEntitlement(user,process.env)){
      Logger.warn(JSON.stringify({event:'staging_test_publishing_entitlement_used',userId:user.id,expiresAt:process.env.CYB_STAGING_TEST_PUBLISH_EXPIRES_AT}),'StagingTestEntitlement');
      return;
    }
    throw new ForbiddenException('Activate CYB Lifetime Access before publishing your website. Your draft is saved.');
  }
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
  @UseGuards(SessionGuard) @Get('draft') async draft(@Req() req:Request & {user:any}) {const b=await selectedBusiness(this.db,req,{website:true});return b?.website||null;}
  @UseGuards(SessionGuard) @Get('publication-diagnostic') async publicationDiagnostic(@Req() req:Request & {user:any}) {
    if(!stagingDiagnosticsEnabled())throw new NotFoundException();
    const business=await this.businessFor(req),website=await this.db.website.findUnique({where:{businessId:business.id}});
    const paths=publicationDifferencePaths(website?.draft as any,website?.published as any);
    const hasPublished=!!website?.published,hasPublishedAt=!!website?.publishedAt;
    const status=!hasPublished||!hasPublishedAt?'Draft':paths.length?'Unpublished changes':'Published';
    return {status,hasDraft:!!website?.draft,hasPublished,hasPublishedAt,changedPathCount:paths.length,changedPaths:paths.slice(0,80),truncated:paths.length>80};
  }
  @UseGuards(SessionGuard) @Put('draft') async saveDraft(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){
    const b=await selectedBusiness(this.db,req);if(!b)throw new NotFoundException('Create a business first');
    const model=validateWebsite(dto.model,false);await assertOwnedMedia(this.db,req.user.id,model);
    const current=await this.db.website.findUnique({where:{businessId:b.id}});
    if(dto.expectedRevision!==undefined&&(current?.revision??0)!==dto.expectedRevision)throw new ConflictException('This website changed in another session. Reload the latest draft before saving your edits.');
    if(!current){try{return await this.db.website.create({data:{businessId:b.id,draft:model as any,revision:1}});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('This website changed in another session. Reload the latest draft before saving your edits.');throw error;}}
    const updated=await this.db.website.updateMany({where:{businessId:b.id,revision:current.revision},data:{draft:model as any,revision:{increment:1}}});
    if(updated.count!==1)throw new ConflictException('This website changed in another session. Reload the latest draft before saving your edits.');
    return this.db.website.findUnique({where:{businessId:b.id}});
  }
  @UseGuards(SessionGuard) @Post('publish') async publish(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){
    const b=await selectedBusiness(this.db,req);if(!b)throw new NotFoundException('Create a business before publishing');await this.requirePaidPublishing(req.user);
    const model=validateWebsite(dto.model,true);await assertOwnedMedia(this.db,req.user.id,model);
    return this.db.$transaction(async tx=>{
      const current=await tx.website.findUnique({where:{businessId:b.id}});
      if(dto.expectedRevision!==undefined&&(current?.revision??0)!==dto.expectedRevision)throw new ConflictException('This website changed in another session. Reload the latest draft before publishing.');
      const publishedAt=new Date();let site:any;
      if(current){const updated=await tx.website.updateMany({where:{businessId:b.id,revision:current.revision},data:{draft:model as any,published:publicWebsite(model) as any,publishedAt,revision:{increment:1}}});if(updated.count!==1)throw new ConflictException('This website changed in another session. Reload the latest draft before publishing.');site=await tx.website.findUnique({where:{businessId:b.id}});}
      else site=await tx.website.create({data:{businessId:b.id,draft:model as any,published:publicWebsite(model) as any,publishedAt,revision:1}});
      const version=await tx.websiteVersion.create({data:{websiteId:site.id,snapshot:site.draft as any}});return {published:true,revision:site.revision,slug:b.slug,versionId:version.id};
    });
  }
  @UseGuards(SessionGuard) @Post('unpublish') async unpublish(@Req() req:Request & {user:any}){const b=await selectedBusiness(this.db,req);if(!b)throw new NotFoundException('Business not found');return this.db.website.updateMany({where:{businessId:b.id},data:{published:Prisma.DbNull,publishedAt:null}});}
  @UseGuards(SessionGuard) @Get('versions') async versions(@Req() req:Request & {user:any}){const b=await selectedBusiness(this.db,req,{website:true});if(!b?.website)return [];return (await this.db.websiteVersion.findMany({where:{websiteId:b.website.id},orderBy:{createdAt:'desc'},take:10})).map(({snapshot,createdAt,...version})=>({...version,model:snapshot,publishedAt:createdAt}));}
  @UseGuards(SessionGuard) @Post('restore/:id') async restore(@Req() req:Request & {user:any}){const b=await selectedBusiness(this.db,req,{website:true});if(!b?.website)throw new NotFoundException('Website not found');const version=await this.db.websiteVersion.findFirst({where:{id:String(req.params['id']),websiteId:b.website.id}});if(!version)throw new NotFoundException('Version not found');const model=validateWebsite(version.snapshot,false);return this.db.website.update({where:{businessId:b.id},data:{draft:model as any,revision:{increment:1}}});}
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
    // Legacy public URLs can contain user-uploaded bytes. Never reflect an
    // arbitrary stored MIME type here: HTML or SVG served from the API origin
    // could execute as active content when a public asset URL is opened.
    const legacyType=String(metadata.metadata.contentType||'').split(';',1)[0].trim().toLowerCase();
    const safeTypes=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']);
    const safe=safeTypes.has(legacyType);
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Content-Type',safe?legacyType:'application/octet-stream');
    if(!safe)response.setHeader('Content-Disposition','attachment');
    response.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return response.status(200).send(Buffer.from(image));
  }
}

function legacyMediaStore() {
  try { return process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN ? getStore({name:'getcyb-assets',siteID:process.env.NETLIFY_BLOBS_SITE_ID,token:process.env.NETLIFY_BLOBS_TOKEN}) : getStore('getcyb-assets'); } catch { throw new ServiceUnavailableException('Legacy media storage is unavailable on this API. Use the updated direct upload flow or configure legacy Netlify Blobs access.'); }
}


@Controller('payments/stripe')
@UseGuards(SessionGuard)
export class StripeController {
  constructor(private db:DbService){}
  private isStripeTestKey(key=process.env.STRIPE_SECRET_KEY||'') {
    return stripeKeyMode(key)==='test';
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
    if(!stripeModeMatchesApplication())throw new ServiceUnavailableException('The Stripe key mode does not match this application environment.');
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
    if(!stripeModeMatchesApplication())throw new ServiceUnavailableException('The Stripe key mode does not match this application environment.');
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
    const expectedMode=expectedStripeMode(),configuredMode=stripeKeyMode();
    const valid=session.id===payment.providerOrderId&&(expectedMode===null||session.livemode===(expectedMode==='live'))&&(configuredMode===null||session.livemode===(configuredMode==='live'))&&session.mode==='payment'&&session.payment_status==='paid'&&session.client_reference_id===payment.userId&&session.metadata?.userId===payment.userId&&session.metadata?.intent==='PLATFORM_ACCESS'&&session.currency===payment.currency.toLowerCase()&&session.amount_total===payment.amountCents;
    if(!valid)throw new BadRequestException('Stripe payment verification failed');
    await db.$transaction(async tx=>{
      const updated=await tx.paymentReference.updateMany({where:{id:payment.id,status:'PENDING'},data:{status:'COMPLETED',providerCaptureId:session.id,metadata:{intent:'PLATFORM_ACCESS',stripeSessionId:session.id,paymentIntentId:session.payment_intent||null}}});
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
    const configuredMode=stripeKeyMode(key),testKey=configuredMode==='test';
    if(!configuredMode||!stripeModeMatchesApplication(key))throw new ServiceUnavailableException('Stripe key mode does not match this application environment');
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
