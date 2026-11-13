import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import cookieParser = require('cookie-parser');
import * as argon2 from 'argon2';
import { AuthController, BusinessController, ProductController, WebsiteController, UploadController } from '../src/routes';
import { SessionGuard } from '../src/session';
import { DbService } from '../src/database';
import { MailService } from '../src/mail';
import { MediaStorage } from '../src/media-storage';

// In-memory authorized fixtures; real HTTP password login and SessionGuard.
// No staging accounts are created and no authentication guard is overridden.
describe('two-account HTTP authorization fixtures',()=>{
  let app:any, base:string, db:any, cookieA:string, cookieB:string;
  beforeAll(async()=>{
    const passwordHash=await argon2.hash('fixture-password-only');
    const users=['a','b'].map(id=>({id,email:`${id}@example.com`,passwordHash,emailVerifiedAt:new Date()}));
    const businesses=users.map(u=>({id:`business-${u.id}`,ownerId:u.id,name:u.id,slug:u.id,settings:{privateNote:u.id},website:{draft:{brandName:u.id,sections:[]}}}));
    const products=users.map(u=>({id:`product-${u.id}`,businessId:`business-${u.id}`,name:u.id,data:{}}));
    const sessions:any[]=[];
    db={
      user:{findUnique:jest.fn(async({where}:any)=>users.find(u=>u.email===where.email))},
      session:{create:jest.fn(async({data}:any)=>sessions.push(data)),findUnique:jest.fn(async({where}:any)=>{const s=sessions.find(s=>s.tokenHash===where.tokenHash);return s?{...s,user:users.find(u=>u.id===s.userId)}:null;})},
      business:{findFirst:jest.fn(async({where}:any)=>businesses.find(b=>b.ownerId===where.ownerId)),findUnique:jest.fn(async({where}:any)=>businesses.find(b=>b.slug===where.slug)),update:jest.fn(async({where,data}:any)=>Object.assign(businesses.find(b=>b.id===where.id)!,data))},
      product:{findMany:jest.fn(async({where}:any)=>products.filter(p=>p.businessId===where.businessId)),findFirst:jest.fn(async({where}:any)=>products.find(p=>p.id===where.id&&p.businessId===where.businessId)),updateMany:jest.fn(),deleteMany:jest.fn(async({where}:any)=>({count:products.some(p=>p.id===where.id&&p.businessId===where.businessId)?1:0}))},
      subscription:{findUnique:jest.fn(async()=>({status:'INACTIVE',billingType:'ONE_TIME'}))},
      mediaAsset:{findFirst:jest.fn(async()=>null)},
      website:{upsert:jest.fn()},$transaction:jest.fn(),
    };
    const module=await Test.createTestingModule({controllers:[AuthController,BusinessController,ProductController,WebsiteController,UploadController],providers:[SessionGuard,MediaStorage,{provide:DbService,useValue:db},{provide:MailService,useValue:{}}]}).compile();
    app=module.createNestApplication();app.use(cookieParser());app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');base=await app.getUrl();
    const login=async(email:string)=>{const res=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'fixture-password-only'})});expect(res.status).toBe(201);return res.headers.get('set-cookie')!.split(';')[0];};
    cookieA=await login('a@example.com');cookieB=await login('b@example.com');
  });
  afterAll(async()=>{await app?.close();});
  const call=(path:string,cookie?:string,method='GET',body?:unknown)=>fetch(`${base}/api/v1${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  it('rejects unauthenticated private reads',async()=>{for(const path of ['/businesses/mine','/products','/websites/draft','/auth/me'])expect((await call(path)).status).toBe(401);});
  it('returns only the signed-in account website, draft, products and settings',async()=>{
    for(const [cookie,id] of [[cookieA,'a'],[cookieB,'b']]){
      const business=await (await call('/businesses/mine',cookie)).json() as any;
      expect(business.ownerId).toBe(id);expect(business.settings.privateNote).toBe(id);
      expect(await (await call('/products',cookie)).json()).toEqual([expect.objectContaining({id:`product-${id}`})]);
      expect(await (await call('/websites/draft',cookie)).json()).toMatchObject({draft:{brandName:id}});
    }
  });
  it('rejects cross-account product editing and deletion',async()=>{
    expect((await call('/products/product-b',cookieA,'PUT',{data:{name:'forbidden'}})).status).toBe(404);
    expect((await call('/products/product-b',cookieA,'DELETE')).status).toBe(404);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });
  it('rejects foreign media completion before accessing object storage',async()=>{
    expect((await call('/uploads/complete/media-b',cookieA,'POST',{})).status).toBe(404);
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith({where:{id:'media-b',ownerId:'a'}});
  });
  it('blocks unpaid publishing and cannot overwrite another account settings',async()=>{
    expect((await call('/websites/publish',cookieA,'POST',{model:{brandName:'a',sections:[]}})).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect((await call('/businesses/mine',cookieA,'PUT',{name:'attack',slug:'b',category:'store',settings:{}})).status).toBe(409);
    expect(db.business.update).not.toHaveBeenCalled();
  });
});
