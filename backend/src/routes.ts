import { Body, Controller, Get, Post, Put, Req, Res, UseGuards, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength, IsObject } from 'class-validator';
import { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DbService } from './database';
import { SessionGuard, tokenHash } from './session';

class Credentials { @IsEmail() email!: string; @IsString() @MinLength(12) @MaxLength(200) password!: string; }
class StoreInput { @IsString() @MaxLength(120) name!: string; @IsString() @MaxLength(100) slug!: string; @IsString() category!: string; @IsObject() settings!: object; }
class JsonInput { @IsObject() data!: Record<string, unknown>; }
class WebsiteInput { @IsObject() model!: Record<string, unknown>; }
const cookieOptions = (expires: Date) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, expires, domain: process.env.COOKIE_DOMAIN || undefined, path: '/' });

@Controller('auth')
export class AuthController {
  constructor(private db: DbService) {}
  @Post('signup') async signup(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where:{email} })) throw new ConflictException('Account already exists');
    const user = await this.db.user.create({ data:{ email, passwordHash:await argon2.hash(dto.password), role:'OWNER' } });
    await this.issueSession(user.id, res); return { id:user.id, email:user.email, emailVerified:false };
  }
  @Post('login') async login(@Body() dto: Credentials, @Res({ passthrough:true }) res: Response) {
    const user = await this.db.user.findUnique({ where:{ email:dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash,dto.password))) throw new BadRequestException('Invalid email or password');
    await this.issueSession(user.id,res); return { id:user.id,email:user.email,emailVerified:!!user.emailVerifiedAt };
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
}

@Controller('products')
@UseGuards(SessionGuard)
export class ProductController {
  constructor(private db:DbService){}
  private async business(userId:string){const b=await this.db.business.findFirst({where:{ownerId:userId}});if(!b)throw new NotFoundException('Create a business first');return b;}
  @Get() async list(@Req() req:Request & {user:any}) {const b=await this.business(req.user.id);return this.db.product.findMany({where:{businessId:b.id},orderBy:{createdAt:'desc'}});}
  @Post() async create(@Req() req:Request & {user:any},@Body() dto:JsonInput){const b=await this.business(req.user.id);const name=String(dto.data.name||'').trim();if(!name)throw new BadRequestException('Product name required');return this.db.product.create({data:{businessId:b.id,name,data:dto.data as any}});}
}

@Controller('websites')
export class WebsiteController {
  constructor(private db:DbService){}
  @UseGuards(SessionGuard) @Get('draft') async draft(@Req() req:Request & {user:any}) {const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});return b?.website||null;}
  @UseGuards(SessionGuard) @Put('draft') async saveDraft(@Req() req:Request & {user:any},@Body() dto:WebsiteInput){const b=await this.db.business.findFirst({where:{ownerId:req.user.id}});if(!b)throw new NotFoundException('Create a business first');return this.db.website.upsert({where:{businessId:b.id},create:{businessId:b.id,draft:dto.model as any},update:{draft:dto.model as any,revision:{increment:1}}});}
  @UseGuards(SessionGuard) @Post('publish') async publish(@Req() req:Request & {user:any}){const b=await this.db.business.findFirst({where:{ownerId:req.user.id},include:{website:true}});if(!b?.website)throw new NotFoundException('Website draft not found');return this.db.$transaction(async tx=>{const site=await tx.website.update({where:{id:b.website!.id},data:{published:b.website!.draft as any,publishedAt:new Date()}});await tx.websiteVersion.create({data:{websiteId:site.id,snapshot:site.draft as any}});return {published:true,revision:site.revision};});}
  @Get('public/:slug') async publicSite(@Req() req:Request){const slug=String(req.params['slug']||'');const business=await this.db.business.findUnique({where:{slug}});if(!business)throw new NotFoundException('Website not found');const site=await this.db.website.findUnique({where:{businessId:business.id}});if(!site?.published)throw new NotFoundException('Website not found');return {business:{name:business.name,slug:business.slug,category:business.category},website:site.published};}
}

@Controller('uploads')
@UseGuards(SessionGuard)
export class UploadController {
  private s3=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:!!process.env.S3_ENDPOINT,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID||'',secretAccessKey:process.env.S3_SECRET_ACCESS_KEY||''}});
  @Post('presign') async presign(@Req() req:Request & {user:any},@Body() input:{contentType:string;fileName:string}) {
    const allowed=['image/jpeg','image/png','image/webp','image/gif'];if(!allowed.includes(input.contentType))throw new BadRequestException('Unsupported image type');
    const key=`businesses/${req.user.id}/${randomBytes(18).toString('hex')}`;
    const cmd=new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,ContentType:input.contentType,Metadata:{owner:req.user.id}});
    return {url:await getSignedUrl(this.s3,cmd,{expiresIn:300}),key,publicUrl:`${process.env.S3_PUBLIC_BASE_URL}/${key}`};
  }
}
