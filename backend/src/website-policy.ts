import { BadRequestException } from '@nestjs/common';

const TYPES=new Set(['hero','about','services','menu','booking','gallery','faq','reviews','footer','heading','text','button','photo','product','chat','contact','divider','spacer','collection','group']);
export function validateWebsite(input:unknown,publishing=true):Record<string,any>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid website.');
  const model=JSON.parse(JSON.stringify(input));
  if(Buffer.byteLength(JSON.stringify(model))>250000)throw new BadRequestException('Your website is too large. Reduce embedded content.');
  if(!publishing)return model;
  if(typeof model.brandName!=='string'||!model.brandName.trim()||model.brandName.length>200)throw new BadRequestException('Add a business name.');
  const pages=model.pages?.length?model.pages:[{id:'home',slug:'',title:'Home',sections:model.sections}];
  if(!Array.isArray(pages)||pages.length>100)throw new BadRequestException('Too many pages.');
  const ids=new Set<string>(),slugs=new Set<string>();
  for(const [index,page]of pages.entries()){
    if(!page.id||ids.has(page.id)||typeof page.slug!=='string'||slugs.has(page.slug)||(index===0&&page.slug!=='')||(index>0&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)))throw new BadRequestException('Page addresses must be valid and unique.');
    ids.add(page.id);slugs.add(page.slug);
    if(!Array.isArray(page.sections)||!page.sections.length||page.sections.length>200)throw new BadRequestException('Every page needs between 1 and 200 sections.');
    const sectionIds=new Set<string>();
    const checkSections=(sections:any[],depth=0)=>{
      if(depth>6||sections.length>200)throw new BadRequestException('Too many nested sections.');
      for(const section of sections){
        if(!section.id||sectionIds.has(section.id)||!TYPES.has(section.type))throw new BadRequestException('Invalid or duplicate section.');sectionIds.add(section.id);
        if(section.href&&!/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(section.href))throw new BadRequestException('Use a safe link destination.');
        for(const url of [section.image,...(section.images||[])])if(url&&!/^(https:\/\/|\/api\/v1\/uploads\/)/i.test(url))throw new BadRequestException('Website images must use HTTPS.');
        const media=[...(Array.isArray(section.media)?section.media:[]),...(Array.isArray(section.items)?section.items.flatMap((item:any)=>Array.isArray(item?.media)?item.media:[]):[])];
        for(const item of media){if(!['image','video'].includes(item.type)||typeof item.url!=='string'||! /^(https:\/\/|\/api\/v1\/uploads\/[a-zA-Z0-9_/-]+$)/i.test(item.url))throw new BadRequestException('Use a safe HTTPS media URL.');}
        if(section.type==='group'){if(!Array.isArray(section.children))throw new BadRequestException('Invalid group.');checkSections(section.children,depth+1);}
        if(sectionIds.size>200)throw new BadRequestException('Too many sections on one page.');
      }
    };
    checkSections(page.sections);
  }
  return model;
}
export function publicWebsite(model:Record<string,any>){
  const result:Record<string,unknown>={};
  for(const key of ['editorVersion','brandName','primaryColor','backgroundColor','textColor','bodyFont','headingFont','buttonRadius','logo','tagline','description','pages','sections','elements','template','headline','buttonText','heroTitle','heroText','heroImageUrl'])if(model[key]!==undefined)result[key]=model[key];
  if(!result.brandName)result.brandName=model.businessName||model.storeName||'Your Business';
  return result;
}

function publicationProjection(model:Record<string,any>={}){
  const projection=publicWebsite(model);
  // The first page's sections are also stored as a legacy compatibility alias.
  if(Array.isArray(projection.pages)&&(projection.pages as any[]).length)delete projection.sections;
  return projection;
}

function stableValue(value:any):any{
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}

function safePathKey(key:string){return key.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,48)||'_';}

/** Returns field paths only; never returns snapshot values or media URLs. */
export function publicationDifferencePaths(draft:Record<string,any>|null|undefined,published:Record<string,any>|null|undefined){
  const left=publicationProjection(draft||{}),right=publicationProjection(published||{}),paths:string[]=[];
  const compare=(a:any,b:any,path:string)=>{
    if(JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b)))return;
    if(Array.isArray(a)||Array.isArray(b)){
      if(!Array.isArray(a)||!Array.isArray(b)){paths.push(path||'$');return;}
      const aa=Array.isArray(a)?a:[],bb=Array.isArray(b)?b:[];
      for(let index=0;index<Math.max(aa.length,bb.length);index++)compare(aa[index],bb[index],`${path}[${index}]`);
      return;
    }
    if(a&&b&&typeof a==='object'&&typeof b==='object'){
      const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
      for(const key of keys)compare(a[key],b[key],path?`${path}.${safePathKey(key)}`:safePathKey(key));
      return;
    }
    paths.push(path||'$');
  };
  compare(left,right,'');
  return paths;
}
