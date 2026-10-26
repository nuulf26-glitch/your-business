import { createDecipheriv } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root=path.resolve(process.argv[2]||'');if(!process.argv[2])throw new Error('Usage: node scripts/verify-firebase-staging-import.mjs /absolute/path/to/export');
if(process.env.IMPORT_TARGET!=='staging')throw new Error('Verification blocked unless IMPORT_TARGET=staging.');
const keyText=process.env.BACKUP_ENCRYPTION_KEY||'',key=/^[a-f0-9]{64}$/i.test(keyText)?Buffer.from(keyText,'hex'):Buffer.from(keyText,'base64');if(key.length!==32)throw new Error('Set BACKUP_ENCRYPTION_KEY to the export encryption key.');
function decrypt(input){const iv=input.subarray(0,12),tag=input.subarray(input.length-16),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(input.subarray(12,input.length-16)),decipher.final()]);}
async function list(dir){try{return (await fs.readdir(dir,{withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>path.join(dir,entry.name)).sort();}catch{return [];}}
const docs=[];for(const file of await list(path.join(root,'firestore')))for(const line of decrypt(await fs.readFile(file)).toString('utf8').trim().split('\n'))if(line)docs.push(JSON.parse(line));
const auth=[];for(const file of await list(path.join(root,'auth')))auth.push(...JSON.parse(decrypt(await fs.readFile(file)).toString('utf8')));
const authIds=auth.filter(row=>row.uid&&row.email).map(row=>row.uid),storeIds=docs.filter(row=>/^stores\/[^/]+$/.test(row.path)&&authIds.includes(row.id)).map(row=>row.id);
const products=docs.filter(row=>/^products\/[^/]+$/.test(row.path)).map(row=>row.id),customers=docs.filter(row=>/^customers\/[^/]+$/.test(row.path)).map(row=>row.id),orders=docs.filter(row=>/^orders\/[^/]+$/.test(row.path)).map(row=>row.id),versions=docs.filter(row=>row.path.startsWith('businessPrivate/')&&row.path.includes('/versions/')).map(row=>row.id),records=docs.filter(row=>{const p=row.path.split('/');return p.length===4&&p[0]==='businessPrivate'&&['bookings','inquiries','notifications','pickupOrders','clientNotes'].includes(p[2]);}).map(row=>row.path),payments=docs.filter(row=>/^users\/[^/]+$/.test(row.path)&&row.data?.paypalOrderId).map(row=>row.id);
const summary=JSON.parse(await fs.readFile(path.join(root,'summary.json'),'utf8'));if(docs.length!==summary.documents||auth.length!==summary.authUsers)throw new Error('Archive counts do not match; verify the encrypted backup first.');
const dbUrl=process.env.DATABASE_URL||'';let host='';try{host=new URL(dbUrl).hostname;}catch{throw new Error('DATABASE_URL is missing or invalid.');}
if(!['localhost','127.0.0.1','::1'].includes(host)&&process.env.IMPORT_STAGING_DB_HOST!==host)throw new Error('Set IMPORT_STAGING_DB_HOST to the exact verified staging database hostname.');
const prisma=new PrismaClient();
try{
 const countIn=async(delegate,field,values)=>{let total=0;for(let i=0;i<values.length;i+=1000)total+=await delegate.count({where:{[field]:{in:values.slice(i,i+1000)}}});return total;};
 const checks=[
  ['users',countIn(prisma.user,'legacyFirebaseUid',authIds),authIds.length],
  ['businesses',countIn(prisma.business,'legacyFirebaseId',storeIds),storeIds.length],
  ['products',countIn(prisma.product,'legacyFirebaseId',products),products.length],
  ['customers',countIn(prisma.customer,'legacyFirebaseId',customers),customers.length],
  ['orders',countIn(prisma.order,'legacyFirebaseId',orders),orders.length],
  ['websites',prisma.website.count({where:{business:{legacyFirebaseId:{in:storeIds}}}}),storeIds.length],
  ['website versions',countIn(prisma.websiteVersion,'legacyFirebaseId',versions),versions.length],
  ['payment references',countIn(prisma.paymentReference,'legacyFirebaseId',payments),payments.length],
  ['business records',countIn(prisma.businessRecord,'legacyFirebasePath',records),records.length],
  ['legacy archive documents',countIn(prisma.legacyDocument,'sourcePath',docs.map(row=>row.path)),docs.length],
 ];
 const results=[];for(const [name,promise,expected] of checks){const found=await promise;results.push({name,expected,found,ok:found===expected});}
 if(summary.storageFiles){const mapping=JSON.parse(await fs.readFile(path.join(root,'storage-url-mapping.json'),'utf8'));results.push({name:'storage URL mappings',expected:summary.storageFiles,found:Object.keys(mapping).length,ok:Object.keys(mapping).length===summary.storageFiles});}
 const failed=results.filter(row=>!row.ok);console.log(JSON.stringify({databaseHost:host,results},null,2));if(failed.length)throw new Error(`Staging migration validation failed for: ${failed.map(row=>row.name).join(', ')}`);
 console.log('Staging import counts and legacy ID/path mappings all match the verified Firebase archive.');
}finally{await prisma.$disconnect();}
