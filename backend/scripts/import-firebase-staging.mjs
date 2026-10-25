import { createDecipheriv } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root=path.resolve(process.argv[2]||'');if(!process.argv[2])throw new Error('Usage: node scripts/import-firebase-staging.mjs /absolute/path/to/export [--apply]');
const apply=process.argv.includes('--apply');
const keyText=process.env.BACKUP_ENCRYPTION_KEY||'',key=/^[a-f0-9]{64}$/i.test(keyText)?Buffer.from(keyText,'hex'):Buffer.from(keyText,'base64');if(key.length!==32)throw new Error('Set BACKUP_ENCRYPTION_KEY to the export encryption key.');
function decrypt(data){const iv=data.subarray(0,12),tag=data.subarray(data.length-16),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data.subarray(12,data.length-16)),decipher.final()]);}
async function filesAt(dir){try{return (await fs.readdir(dir,{withFileTypes:true})).filter(x=>x.isFile()).map(x=>path.join(dir,x.name)).sort();}catch{return [];}}
const docs=[];for(const file of await filesAt(path.join(root,'firestore'))){for(const line of decrypt(await fs.readFile(file)).toString('utf8').trim().split('\n'))if(line)docs.push(JSON.parse(line));}
const authUsers=[];for(const file of await filesAt(path.join(root,'auth'))){authUsers.push(...JSON.parse(decrypt(await fs.readFile(file)).toString('utf8')));}
const summary=JSON.parse(await fs.readFile(path.join(root,'summary.json'),'utf8'));
if(docs.length!==summary.documents||authUsers.length!==summary.authUsers)throw new Error('Archive counts do not match. Run verify:firebase-backup first.');
const counts={documents:docs.length,authUsers:authUsers.length,stores:docs.filter(x=>x.path.split('/').length===2&&x.path.startsWith('stores/')).length,products:docs.filter(x=>x.path.startsWith('products/')).length,orders:docs.filter(x=>x.path.startsWith('orders/')).length,customers:docs.filter(x=>x.path.startsWith('customers/')).length};
console.log(JSON.stringify({mode:apply?'STAGING IMPORT':'DRY RUN',archive:root,counts},null,2));
if(!apply)process.exit(0);
if(process.env.IMPORT_TARGET!=='staging'||process.env.ALLOW_STAGING_IMPORT!=='YES')throw new Error('Import blocked. Set IMPORT_TARGET=staging and ALLOW_STAGING_IMPORT=YES only for a verified staging database.');
const dbUrl=process.env.DATABASE_URL||'';let host='';try{host=new URL(dbUrl).hostname;}catch{throw new Error('DATABASE_URL is missing or invalid.');}
const localHost=['localhost','127.0.0.1','::1'].includes(host);if(!localHost&&(!process.env.IMPORT_STAGING_DB_HOST||process.env.IMPORT_STAGING_DB_HOST!==host))throw new Error('Import blocked: set IMPORT_STAGING_DB_HOST to the exact verified staging database hostname.');
const prisma=new PrismaClient();
try{
  for(let i=0;i<authUsers.length;i+=200){const chunk=authUsers.slice(i,i+200).filter(u=>u.uid&&u.email);if(chunk.length)await prisma.user.createMany({data:chunk.map(u=>({legacyFirebaseUid:u.uid,email:String(u.email).toLowerCase(),emailVerifiedAt:u.emailVerified?new Date():null,passwordHash:null,role:'OWNER'})),skipDuplicates:true});}
  const userIds=new Map((await prisma.user.findMany({select:{id:true,legacyFirebaseUid:true}})).filter(u=>u.legacyFirebaseUid).map(u=>[u.legacyFirebaseUid,u.id]));
  const storeDocs=docs.filter(x=>x.path.split('/').length===2&&x.path.startsWith('stores/'));
  const businesses=[];const used=new Set((await prisma.business.findMany({select:{slug:true}})).map(x=>x.slug));
  for(const row of storeDocs){const uid=row.id,ownerId=userIds.get(uid);if(!ownerId)continue;let slug=String(row.data.storeUrl||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,90);if(!slug)slug=`migrated-${uid.slice(0,8)}`;if(used.has(slug))slug=`${slug.slice(0,88)}-${uid.slice(0,8)}`;used.add(slug);businesses.push({legacyFirebaseId:uid,ownerId,name:String(row.data.businessName||row.data.storeName||'My Business').slice(0,120),slug,category:String(row.data.businessCategory||row.data.businessGoal||'general').slice(0,60),settings:row.data});}
  for(let i=0;i<businesses.length;i+=200)await prisma.business.createMany({data:businesses.slice(i,i+200),skipDuplicates:true});
  const businessRows=await prisma.business.findMany({select:{id:true,legacyFirebaseId:true,slug:true}}),byUid=new Map(businessRows.filter(x=>x.legacyFirebaseId).map(x=>[x.legacyFirebaseId,x])),bySlug=new Map(businessRows.map(x=>[x.slug,x]));
  const docsByPath=new Map(docs.map(row=>[row.path,row]));
  const dateValue=value=>{if(!value)return null;if(typeof value==='string'||typeof value==='number')return new Date(value);if(value.__getcybType==='timestamp')return new Date(value.value);return null;};
  for(const store of storeDocs){const business=byUid.get(store.id);if(!business)continue;const draft=docsByPath.get(`businessPrivate/${store.id}/website/draft`)?.data?.model||store.data.draftEditorData||store.data.editorData||{};const projection=docsByPath.get(`publishedWebsites/${store.data.publishedSlug||store.data.storeUrl}`);const published=store.data.published!==false&&projection?.data?.published!==false?projection?.data?.model:null;const websiteData={draft,published:published||undefined,publishedAt:dateValue(projection?.data?.publishedAt)};await prisma.website.upsert({where:{businessId:business.id},create:{businessId:business.id,...websiteData},update:websiteData});}
  for(const row of docs.filter(x=>x.path.startsWith('businessPrivate/')&&x.path.includes('/versions/'))){const parts=row.path.split('/'),uid=parts[1],versionId=parts[3];const business=byUid.get(uid);if(!business)continue;const website=await prisma.website.findUnique({where:{businessId:business.id},select:{id:true}});if(!website)continue;const snapshot=row.data.model||row.data;await prisma.websiteVersion.createMany({data:[{legacyFirebaseId:versionId,websiteId:website.id,snapshot}],skipDuplicates:true});}
  const products=[],customers=[],orders=[];
  for(const row of docs){const rootCollection=row.path.split('/')[0];if(row.path.split('/').length!==2)continue;const data=row.data||{};let business=(data.userId&&byUid.get(data.userId))||(data.storeUrl&&bySlug.get(data.storeUrl));if(!business)continue;
    if(rootCollection==='products')products.push({legacyFirebaseId:row.id,businessId:business.id,name:String(data.name||data.title||'Imported product').slice(0,200),data});
    if(rootCollection==='customers')customers.push({legacyFirebaseId:row.id,businessId:business.id,data});
    if(rootCollection==='orders'){const raw=data.amountCents!=null?Number(data.amountCents):data.total!=null?Number(data.total)*100:data.totalAmount!=null?Number(data.totalAmount)*100:null;const amountCents=Number.isFinite(raw)?Math.round(raw):null;orders.push({legacyFirebaseId:row.id,businessId:business.id,status:String(data.status||'pending').slice(0,40),amountCents,currency:String(data.currency||'USD').slice(0,3),data});}
  }
  for(let i=0;i<products.length;i+=200)await prisma.product.createMany({data:products.slice(i,i+200),skipDuplicates:true});
  for(let i=0;i<customers.length;i+=200)await prisma.customer.createMany({data:customers.slice(i,i+200),skipDuplicates:true});
  for(let i=0;i<orders.length;i+=200)await prisma.order.createMany({data:orders.slice(i,i+200),skipDuplicates:true});
  const paymentRows=docs.filter(x=>x.path.startsWith('users/')&&x.path.split('/').length===2).flatMap(row=>{const data=row.data||{},userId=userIds.get(row.id);if(!userId||!data.paypalOrderId)return [];const amount=Number(data.paymentAmount);return [{legacyFirebaseId:row.id,provider:'paypal',providerOrderId:String(data.paypalOrderId),providerCaptureId:data.paypalCaptureId?String(data.paypalCaptureId):null,status:data.paid?'COMPLETED':String(data.subscriptionStatus||'UNKNOWN').toUpperCase(),amountCents:Number.isFinite(amount)?Math.round(amount*100):null,currency:String(data.paymentCurrency||'USD').slice(0,3),userId,metadata:{paymentType:data.paymentType||null,plan:data.plan||null,paidAt:data.paidAt||null}}];});
  for(let i=0;i<paymentRows.length;i+=200)await prisma.paymentReference.createMany({data:paymentRows.slice(i,i+200),skipDuplicates:true});
  for(let i=0;i<docs.length;i+=200)await prisma.legacyDocument.createMany({data:docs.slice(i,i+200).map(row=>({sourcePath:row.path,collectionPath:row.path.slice(0,row.path.lastIndexOf('/')),sourceId:row.id,data:row.data})),skipDuplicates:true});
  console.log(JSON.stringify({imported:{users:authUsers.filter(u=>u.uid&&u.email).length,businesses:businesses.length,products:products.length,customers:customers.length,orders:orders.length,paymentReferences:paymentRows.length,legacyDocuments:docs.length},note:'Firebase Storage objects remain in the verified encrypted archive; the S3 asset copy phase is not included in this staging importer.'},null,2));
}finally{await prisma.$disconnect();}
