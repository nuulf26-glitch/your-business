import { Body, Controller, Get, Post, Put, Patch, Delete, Req, Res, UseGuards, BadRequestException, NotFoundException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength, IsObject, IsIn, IsInt, Max, IsOptional } from 'class-validator';
import { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Throttle } from '@nestjs/throttler';
import { DbService } from './database';
import { Prisma } from '@prisma/client';
import { SessionGuard, tokenHash } from './session';
import { MailService } from './mail';
import { FirebaseBridge } from './firebase-bridge';
import { publicWebsite, validateWebsite } from './website-policy';

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
class TokenInput { @IsString() @MinLength(32) @MaxLength(200) token!: string; }
class ResetInput extends TokenInput { @IsString() @MinLength(12) @MaxLength(200) password!: string; }
class EmailInput { @IsEmail() email!: string; }
class PayPalCaptureInput { @IsString() @MaxLength(100) orderId!: string; }
class OrderStatusInput { @IsString() @MaxLength(30) status!: string; }
class CustomerStatusInput { @IsString() @MaxLength(30) status!: string; }
class IdInput { @IsString() @MaxLength(120) id!: string; }
class FirebaseTokenInput { @IsString() @MinLength(100) @MaxLength(10_000) idToken!: string; }
class UploadInput { @IsIn(['image/jpeg','image/png','image/webp','image/gif']) contentType!: string; @IsInt() @Max(10*1024*1024) fileSize!: number; }
const cookieOptions = (expires: Date) => {const sameSite=(process.env.COOKIE_SAME_SITE||'lax') as 'lax'|'strict'|'none';return {httpOnly:true,secure:process.env.NODE_ENV==='production'||sameSite==='none',sameSite,expires,domain:process.env.COOKIE_DOMAIN||undefined,path:'/'};};

@Controller('auth')
export class AuthController {
  private logger=new Logger(AuthController.name);
  constructor(private db: DbService, private mail:MailService, private firebase:FirebaseBridge) {}
  @Throttle({default:{limit:10,ttl:60_000}})
  @Post('firebase-exchange') async firebaseExchange(@Body() dto:FirebaseTokenInput,@Res({passthrough:true}) res:Response){
    const claim=await this.firebase.verifyIdToken(dto.idToken);
    const email=claim.email?.trim().toLowerCase();if(!email||!claim.email_verified)throw new BadRequestException('A verified email is required');
    let user=await this.db.user.findUnique({where:{legacyFirebaseUid:claim.uid}});
    if(!user){
      const existing=await this.db.user.findUnique({where:{email}});
      if(existing?.legacyFirebaseUid&&existing.legacyFirebaseUid!==claim.uid)throw new ConflictException('This email is linked to another account');
      user=existing?await this.db.user.update({where:{id:existing.id},data:{legacyFirebaseUid:claim.uid,emailVerifiedAt:existing.emailVerifiedAt||new Date()}}):await this.db.user.create({data:{email,legacyFirebaseUid:claim.uid,emailVerifiedAt:new Date(),passwordHash:null,role:'OWNER'}});
      if(!existing)await this.db.subscription.create({data:{userId:user.id,trialEndsAt:new Date(Date.now()+14*864e5)}});
    }
    await this.issueSession(user.id,res);
    return {id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt};
  }
  @Throttle({default:{limit:5,ttl:60_000}})
  @Post('signup') async signup(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where:{email} })) throw new ConflictException('Account already exists');
    const trialEndsAt = new Date(Date.now()+14*864e5);
    const businessName = dto.businessName?.trim() || '';
    const slugBase = businessName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'business';
    const user = await this.db.$transaction(async tx => {
      const created = await tx.user.create({ data:{ email, fullName:dto.fullName?.trim() || null, passwordHash:await argon2.hash(dto.password), role:'OWNER' } });
      await tx.subscription.create({data:{userId:created.id,trialEndsAt}});
      await tx.business.create({data:{ownerId:created.id,name:businessName,slug:`${slugBase}-${created.id.slice(-6)}`,website:{create:{}}}});
      return created;
    });
    try {
      await this.createEmailLink(user.id,email,'verify');
    } catch (error) {
      const cause = error as { code?: string; command?: string; responseCode?: number };
      this.logger.error(`Signup verification email failed (code=${cause?.code || 'unknown'}, command=${cause?.command || 'unknown'}, response=${cause?.responseCode || 'unknown'})`);
      // Keep the account and its trial/business records. Deleting them made a
      // transient SMTP failure look like signup failed and blocked retries.
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Your account was created, but the verification email could not be sent. Try resending the verification email later.');
      }
    }
    if(process.env.NODE_ENV!=='production') await this.issueSession(user.id, res);
    return { id:user.id, email:user.email, emailVerified:false, trialEndsAt:trialEndsAt.toISOString() };
  }
  @Throttle({default:{limit:8,ttl:60_000}})
  @Post('login') async login(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const user = await this.db.user.findUnique({ where:{ email:dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash,dto.password))) throw new BadRequestException('Invalid email or password');
    if (process.env.NODE_ENV==='production'&&!user.emailVerifiedAt) throw new BadRequestException('Verify your email before signing in');
    await this.issueSession(user.id,res); return { id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt };
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
    await this.db.session.create({ data:{ userId, tokenHash:tokenHash(token), expiresAt:expires } }); res.cookie('getcyb_session',token,cookieOptions(expires));
  }
  @UseGuards(SessionGuard) @Get('me') me(@Req() req:Request & {user:any}) { return {id:req.user.id,email:req.user.email,emailVerified:!!req.user.emailVerifiedAt,role:req.user.role}; }
  @UseGuards(SessionGuard) @Post('logout') async logout(@Req() req:Request & {user:any},@Res({passthrough:true}) res:Response) {
    const token=req.cookies?.getcyb_session; if(token) await this.db.session.deleteMany({where:{tokenHash:tokenHash(token)}}); res.clearCookie('getcyb_session',{...cookieOptions(new Date(0))}); return {ok:true};
  }
}

@Controller('businesses')
export class BusinessController {
  constructor(private db:DbService){}
  @UseGuards(SessionGuard) @Get('mine') async mine(@Req() req:Request & {user:any}) { return this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}}); }
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
    return {id:business.id,name:business.name,slug:business.slug,category:business.category,settings:publicSettings};
  }
}

@Controller('products')
@UseGuards(SessionGuard)
export class ProductController {
  constructor(private db:DbService){}
  private async business(userId:string){const b=await this.db.business.findFirst({where:{ownerId:userId}});if(!b)throw new NotFoundException('Create a business first');return b;}
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.business(req.user.id);return this.db.product.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'}});}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req.user.id);const name=String(dto.data.name||'').trim();if(!name)throw new BadRequestException('Product name required');return this.db.product.create({data:{businessId:b.id,name,data:dto.data as any}});}
  @Put(':id') async update(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req.user.id);const id=String(req.params['id']);const name=String(dto.data.name||'').trim();if(!name)throw new BadRequestException('Product name required');const result=await this.db.product.updateMany({where:{id,businessId:b.id},data:{name,data:dto.data as any}});if(!result.count)throw new NotFoundException('Product not found');return this.db.product.findUnique({where:{id}});}
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
      return {id:row.id,name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category};
    });
  }
  @Get('item/:id') async one(@Req() req:Request){const id=String(req.params['id']||'');const row=await this.db.product.findUnique({where:{id},include:{business:{include:{website:true}}}});if(!row||!row.business.website?.published||(row.data as any)?.status==='hidden')throw new NotFoundException('Product not found');const data=row.data as Record<string,unknown>;return {id:row.id,name:row.name,description:data.description,imageUrl:data.imageUrl,image:data.image,sellingPrice:data.sellingPrice,salePrice:data.salePrice,salePercent:data.salePercent,status:data.status,category:data.category};}
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
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const data=dto.data as Record<string,any>;const amount=Number(data.total??data.amount);return this.db.order.create({data:{businessId:b.id,status:String(data.status||'pending'),amountCents:Number.isFinite(amount)?Math.round(amount*100):null,currency:String(data.currency||'USD'),data:data as any}});}
  @Patch(':id/status') async updateStatus(@Req() req:Request & {user:any},@Body() dto:OrderStatusInput){
    const valid=['new','pending','paid','processing','shipped','delivered','cancelled','refunded'];if(!valid.includes(dto.status.toLowerCase()))throw new BadRequestException('Invalid order status');
    const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');
    const id=String(req.params['id']);const result=await this.db.order.updateMany({where:{id,businessId:b.id},data:{status:dto.status.toLowerCase()}});if(!result.count)throw new NotFoundException('Order not found');
    return this.db.order.findUnique({where:{id}});
  }
  @Delete(':id') async remove(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');const result=await this.db.order.deleteMany({where:{id:String(req.params['id']),businessId:b.id}});if(!result.count)throw new NotFoundException('Order not found');return {deleted:true};}
}

@Controller('websites')
export class WebsiteController {
  constructor(private db:DbService){}
  @UseGuards(SessionGuard) @Get('draft') async draft(@Req() req:Request & {user:any}) {const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});return b?.website||null;}
  @UseGuards(SessionGuard) @Put('draft') async saveDraft(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business first');const model=validateWebsite(dto.model,false);return this.db.website.upsert({where:{businessId:b.id},create:{businessId:b.id,draft:model as any},update:{draft:model as any,revision:{increment:1}}});}
  @UseGuards(SessionGuard) @Post('publish') async publish(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website draft not found');const model=validateWebsite(dto.model,true);return this.db.$transaction(async tx=>{const site=await tx.website.update({where:{id:b.website!.id},data:{draft:model as any,published:publicWebsite(model) as any,publishedAt:new Date(),revision:{increment:1}}});const version=await tx.websiteVersion.create({data:{websiteId:site.id,snapshot:site.draft as any}});return {published:true,revision:site.revision,slug:b.slug,versionId:version.id};});}
  @UseGuards(SessionGuard) @Post('unpublish') async unpublish(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Business not found');return this.db.website.updateMany({where:{businessId:b.id},data:{published:Prisma.DbNull,publishedAt:null}});}
  @UseGuards(SessionGuard) @Get('versions') async versions(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)return [];return (await this.db.websiteVersion.findMany({where:{websiteId:b.website.id},orderBy:{createdAt:'desc'},take:10})).map(({snapshot,createdAt,...version})=>({...version,model:snapshot,publishedAt:createdAt}));}
  @UseGuards(SessionGuard) @Post('restore/:id') async restore(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website not found');const version=await this.db.websiteVersion.findFirst({where:{id:String(req.params['id']),websiteId:b.website.id}});if(!version)throw new NotFoundException('Version not found');const model=validateWebsite(version.snapshot,false);return this.db.website.update({where:{businessId:b.id},data:{draft:model as any,revision:{increment:1}}});}
  @Get('public/:slug') async publicSite(@Req() req:Request){const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug}});if(!business)throw new NotFoundException('Website not found');const site=await this.db.website.findUnique({where:{businessId:business.id}});return {business:{name:business.name,slug:business.slug,category:business.category},website:site?.published||null,published:!!site?.published};}
}

@Controller('uploads')
@UseGuards(SessionGuard)
export class UploadController {
  private s3=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:!!process.env.S3_ENDPOINT,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID||'',secretAccessKey:process.env.S3_SECRET_ACCESS_KEY||''}});
  @Post('presign') async presign(@Req() req:Request & {user:any},@Body() input:UploadInput) {
    const allowed=['image/jpeg','image/png','image/webp','image/gif'];if(!allowed.includes(input.contentType))throw new BadRequestException('Unsupported image type');
    if(input.fileSize<1||input.fileSize>10*1024*1024)throw new BadRequestException('Images must be 10 MB or smaller');
    const key=`businesses/${req.user.id}/${randomBytes(18).toString('hex')}`;
    const cmd=new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,ContentType:input.contentType,ContentLength:input.fileSize,Metadata:{owner:req.user.id}});
    return {url:await getSignedUrl(this.s3,cmd,{expiresIn:300}),key,publicUrl:`${process.env.S3_PUBLIC_BASE_URL}/${key}`};
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
    const {token,base}=await this.accessToken(),amount=process.env.PAYPAL_BASIC_AMOUNT||'245.00';
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
