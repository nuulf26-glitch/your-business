import { createCipheriv, randomBytes, createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const keyText = process.env.BACKUP_ENCRYPTION_KEY || '';
const key = /^[a-f0-9]{64}$/i.test(keyText) ? Buffer.from(keyText,'hex') : Buffer.from(keyText,'base64');
if (key.length !== 32) throw new Error('Set BACKUP_ENCRYPTION_KEY to a base64 or hex encoded 32-byte key.');
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const root = path.resolve(process.env.EXPORT_DIR || `./private-backups/firebase-${stamp}`);
await fs.mkdir(root,{recursive:true,mode:0o700});
await fs.chmod(root,0o700);
const entries=await fs.readdir(root);if(entries.length)throw new Error(`Export directory must be empty: ${root}`);
let app=getApps()[0];
if(!app){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;app=raw?initializeApp({credential:cert(JSON.parse(raw)),storageBucket:bucketName}):initializeApp({storageBucket:bucketName});}
const db=getFirestore(app), auth=getAuth(app), bucket=getStorage(app).bucket(bucketName);

function encode(value){
  if(value instanceof Timestamp)return {__getcybType:'timestamp',value:value.toDate().toISOString()};
  if(value instanceof GeoPoint)return {__getcybType:'geoPoint',latitude:value.latitude,longitude:value.longitude};
  if(value instanceof DocumentReference)return {__getcybType:'documentReference',path:value.path};
  if(Buffer.isBuffer(value))return {__getcybType:'bytes',base64:value.toString('base64')};
  if(Array.isArray(value))return value.map(encode);
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=encode(v);return out;}
  return value;
}
function encryptBuffer(input){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(input),cipher.final(),cipher.getAuthTag()]);}
async function writeEncryptedJson(file,value){const data=encryptBuffer(Buffer.from(JSON.stringify(value)));await fs.writeFile(file,data,{mode:0o600,flag:'wx'});}
const summary={createdAt:new Date().toISOString(),projectId:app.options.projectId||process.env.FIREBASE_PROJECT_ID||null,collections:0,documents:0,authUsers:0,storageFiles:0,storageBytes:0};
const recordsDir=path.join(root,'firestore');await fs.mkdir(recordsDir,{mode:0o700});
const batchSize=400;
async function exportCollection(collectionRef){
  summary.collections++;
  let cursor;
  do{
    let query=collectionRef.orderBy('__name__').limit(batchSize);if(cursor)query=query.startAfter(cursor);
    const snap=await query.get();if(!snap.size)break;
    const rows=snap.docs.map(doc=>({path:doc.ref.path,id:doc.id,data:encode(doc.data())}));
    const seq=String(Math.floor(summary.documents/batchSize)).padStart(7,'0');
    const file=path.join(recordsDir,`${Buffer.from(collectionRef.path).toString('base64url')}.${seq}.ndjson.enc`);
    await fs.writeFile(file,encryptBuffer(Buffer.from(rows.map(x=>JSON.stringify(x)).join('\n')+'\n')),{mode:0o600,flag:'wx'});
    summary.documents+=rows.length;cursor=snap.docs.at(-1);
    for(const doc of snap.docs){for(const child of await doc.ref.listCollections())await exportCollection(child);}
  }while(cursor);
}
for(const collection of await db.listCollections())await exportCollection(collection);

const authDir=path.join(root,'auth');await fs.mkdir(authDir,{mode:0o700});
let authPageToken;
do{
  const page=await auth.listUsers(1000,authPageToken);
  const rows=page.users.map(user=>{const row=user.toJSON();if(user.passwordHash)row.passwordHash=user.passwordHash;if(user.passwordSalt)row.passwordSalt=user.passwordSalt;return row;});
  if(rows.length){const file=path.join(authDir,`users.${String(summary.authUsers).padStart(9,'0')}.json.enc`);await writeEncryptedJson(file,rows);summary.authUsers+=rows.length;}
  authPageToken=page.pageToken;
}while(authPageToken);

const storageDir=path.join(root,'storage');await fs.mkdir(storageDir,{mode:0o700});
const manifest=[];let storagePageToken;
do{
  const [files,next]=await bucket.getFiles({autoPaginate:false,maxResults:500,pageToken:storagePageToken});
  for(const file of files){
    const index=summary.storageFiles,metadata=await file.getMetadata(),local=path.join(storageDir,`${String(index).padStart(9,'0')}.blob.enc`),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),hash=createHash('sha256');let size=0;
    const measure=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;hash.update(chunk);callback(null,chunk);}});
    const out=createWriteStream(local,{flags:'wx',mode:0o600});out.write(iv);await pipeline(file.createReadStream(),measure,cipher,out);await fs.appendFile(local,cipher.getAuthTag());await fs.chmod(local,0o600);
    manifest.push({file:index,objectName:file.name,sha256:hash.digest('hex'),size,contentType:metadata[0].contentType||null,metadata:encode(metadata[0].metadata||{}),generation:metadata[0].generation||null});summary.storageFiles++;summary.storageBytes+=size;
  }
  storagePageToken=next?.pageToken;
}while(storagePageToken);
await writeEncryptedJson(path.join(root,'storage-manifest.json.enc'),manifest);
await fs.writeFile(path.join(root,'summary.json'),JSON.stringify(summary,null,2),{mode:0o600,flag:'wx'});
console.log(`Encrypted read-only export finished: ${summary.collections} collections, ${summary.documents} documents, ${summary.authUsers} Auth users, ${summary.storageFiles} files (${summary.storageBytes} bytes).`);
console.log(`Export directory: ${root}`);
