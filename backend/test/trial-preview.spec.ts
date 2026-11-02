import { AuthController, TrialPreviewController, WebsiteController } from '../src/routes';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { tokenHash } from '../src/session';

describe('Try CYB preview',()=>{
  it.each([
    ['professional consulting company','Make your next move with confidence.','Explore our approach'],
    ['creative portfolio','A considered home for your creative work.','Explore the work'],
  ])('creates a service-focused preview for a %s',async(prompt,headline,buttonText)=>{
    let cookie='';
    const row:any={id:'preview-category',tokenHash:'',draft:null,prompt:null,generatedAt:null,claimedUserId:null,expiresAt:new Date(Date.now()+864e5)};
    const db:any={trialPreview:{
      deleteMany:jest.fn().mockResolvedValue({count:0}),
      create:jest.fn(async({data}:any)=>{Object.assign(row,data);return row;}),
      findFirst:jest.fn(async({where}:any)=>where.tokenHash===row.tokenHash&&row.expiresAt>new Date()?row:null),
      updateMany:jest.fn(async({data}:any)=>{if(row.generatedAt&&data.generatedAt)return {count:0};Object.assign(row,data);return {count:1};}),
    }};
    const controller=new TrialPreviewController(db);
    await controller.session({cookies:{}} as any,{cookie:(_name:string,value:string)=>{cookie=value;}} as any);
    const result=await controller.generate({cookies:{cyb_preview:cookie}} as any,{prompt:`Create a ${prompt} called North Star.`} as any);
    const sections=(result.model as any).pages[0].sections;
    const hero=sections.find((section:any)=>section.type==='hero');
    const offer=sections.find((section:any)=>section.id==='preview-offer');
    expect(hero.title).toBe(headline);
    expect(hero.buttonText).toBe(buttonText);
    expect(offer.type).toBe('services');
    expect(offer.items.length).toBeGreaterThan(0);
    expect(sections.some((section:any)=>section.type==='reviews'||section.type==='collection')).toBe(false);
  });

  it('creates one deterministic draft, saves edits server-side, and returns the same draft on retry',async()=>{
    let cookie='';
    const row:any={id:'preview-1',tokenHash:'',draft:null,prompt:null,generatedAt:null,claimedUserId:null,expiresAt:new Date(Date.now()+864e5)};
    const db:any={trialPreview:{
      deleteMany:jest.fn().mockResolvedValue({count:0}),
      create:jest.fn(async({data}:any)=>{Object.assign(row,data);return row;}),
      findFirst:jest.fn(async({where}:any)=>where.tokenHash===row.tokenHash&&row.expiresAt>new Date()?row:null),
      findUnique:jest.fn(async()=>row),
      updateMany:jest.fn(async({data}:any)=>{if(row.generatedAt&&data.generatedAt)return {count:0};Object.assign(row,data);return {count:1};}),
    }};
    const controller=new TrialPreviewController(db);
    await controller.session({cookies:{}} as any,{cookie:(_name:string,value:string)=>{cookie=value;}} as any);
    expect(cookie).toHaveLength(43);
    expect(row.tokenHash).toBe(tokenHash(cookie));
    const request={cookies:{cyb_preview:cookie}} as any;
    const first=await controller.generate(request,{prompt:'Create a luxury skincare store in beige. Brand name Luma.'} as any);
    expect(first.generated).toBe(true);
    expect((first.model as any).pages[0].sections.some((section:any)=>section.type==='hero')).toBe(true);
    expect((first.model as any).brandName).toBe('Luma');
    const original=(first.model as any).brandName;
    const retry=await controller.generate(request,{prompt:'Create a different coffee shop.'} as any);
    expect((retry.model as any).brandName).toBe(original);
    expect(db.trialPreview.updateMany).toHaveBeenCalledTimes(1);
    const edited=JSON.parse(JSON.stringify(first.model));edited.brandName='My Studio';
    await controller.save(request,{model:edited} as any);
    expect((await controller.getPreview(request)).model).toMatchObject({brandName:'My Studio'});
  });

  it('does not allow preview creation or publishing without an authenticated/paid route',async()=>{
    const controller=new TrialPreviewController({} as any);
    await expect(controller.generate({cookies:{}} as any,{prompt:'A good prompt for a shop'} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    const websites=new WebsiteController({business:{findFirst:jest.fn().mockResolvedValue({id:'free-business'})},subscription:{findUnique:jest.fn().mockResolvedValue({status:'TRIALING',billingType:'TRIAL'})}} as any);
    await expect((websites as any).publish({user:{id:'free-account'}},{model:{}})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves the saved preview into the new account draft after signup',async()=>{
    const previewToken='preview-token-with-enough-entropy-123456789';
    const draft={editorVersion:2,brandName:'Atelier Botanique',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'A softer ritual'}]}]};
    const user={id:'new-user',email:'nouf@example.test',emailVerifiedAt:new Date()};
    const tx:any={user:{create:jest.fn().mockResolvedValue(user)},termsConsent:{create:jest.fn()},subscription:{create:jest.fn()},business:{create:jest.fn().mockResolvedValue({id:'new-business'})},trialPreview:{findFirst:jest.fn().mockResolvedValue({id:'preview-row',draft,expiresAt:new Date(Date.now()+864e5)}),update:jest.fn()},website:{update:jest.fn()}};
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null)},$transaction:jest.fn(async(callback:any)=>callback(tx)),session:{create:jest.fn()},trialPreview:tx.trialPreview};
    const res:any={cookie:jest.fn(),clearCookie:jest.fn()};
    await new AuthController(db,{} as any).signup({cookies:{cyb_preview:previewToken}} as any,{email:user.email,password:'a-secure-password',fullName:'Nouf',businessName:'Atelier',acceptedTerms:true} as any,res);
    expect(tx.website.update).toHaveBeenCalledWith({where:{businessId:'new-business'},data:{draft}});
    expect(tx.trialPreview.update).toHaveBeenCalledWith({where:{id:'preview-row'},data:{claimedUserId:'new-user'}});
    expect(tx.termsConsent.create).toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('cyb_preview',{path:'/'});
  });
});
