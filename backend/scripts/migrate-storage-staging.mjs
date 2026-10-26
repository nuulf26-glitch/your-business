import { createDecipheriv, createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Usage: node scripts/migrate-storage-staging.mjs /absolute/path/to/export --apply');
if(!process.argv.includes('--apply'))throw new Error('This command requires --apply; review the verified archive and staging bucket first.');
if(process.env.IMPORT_TARGET!=='staging'||process.env.ALLOW_STAGING_IMPORT!=='YES')throw new Error('Storage migration blocked. Set IMPORT_TARGET=staging and ALLOW_STAGING_IMPORT=YES.');
const keyText=process.env.BACKUP_ENCRYPTION_KEY||'',key=/^[a-f0-9]{64}$/i.test(keyText)?Buffer.from(keyText,'hex'):Buffer.from(keyText,'base64');
if(key.length!==32)throw new Error('Set BACKUP_ENCRYPTION_KEY to the export encryption key.');
const bucket=process.env.S3_BUCKET,publicBase=process.env.S3_PUBLIC_BASE_URL;
if(!bucket||!publicBase||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY)throw new Error('Configure S3_BUCKET, S3_PUBLIC_BASE_URL, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
const summary=JSON.parse(await fs.readFile(path.join(root,'summary.json'),'utf8'));
const manifestPath=path.join(root,'storage-manifest.json.enc'),encryptedManifest=await fs.readFile(manifestPath);
const iv=encryptedManifest.subarray(0,12),tag=encryptedManifest.subarray(encryptedManifest.length-16),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
const manifest=JSON.parse(Buffer.concat([decipher.update(encryptedManifest.subarray(12,encryptedManifest.length-16)),decipher.final()]).toString('utf8'));
if(manifest.length!==summary.storageFiles)throw new Error('Storage manifest count does not match the export summary. Run verify:firebase-backup first.');
const client=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:!!process.env.S3_ENDPOINT,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
const mapping={};
for(const item of manifest){
  const file=path.join(root,'storage',`${String(item.file).padStart(9,'0')}.blob.enc`),stat=await fs.stat(file);
  const handle=await fs.open(file,'r'),fileIv=Buffer.alloc(12),authTag=Buffer.alloc(16);await handle.read(fileIv,0,12,0);await handle.read(authTag,0,16,stat.size-16);await handle.close();
  const decrypt=createDecipheriv('aes-256-gcm',key,fileIv);decrypt.setAuthTag(authTag);const hash=createHash('sha256');let size=0;
  const verify=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;hash.update(chunk);callback(null,chunk);}});
  const body=createReadStream(file,{start:12,end:stat.size-17}).pipe(decrypt).pipe(verify);
  const objectKey=`legacy-firebase/${createHash('sha256').update(item.objectName).digest('hex')}`;
  await client.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:body,ContentLength:item.size,ContentType:item.contentType||'application/octet-stream'}));
  if(size!==item.size||hash.digest('hex')!==item.sha256)throw new Error(`Uploaded asset failed integrity validation: ${item.objectName}`);
  mapping[item.objectName]=`${publicBase.replace(/\/$/,'')}/${objectKey}`;
}
const output=path.join(root,'storage-url-mapping.json');await fs.writeFile(output,JSON.stringify(mapping,null,2),{flag:'wx',mode:0o600});
console.log(`Copied and verified ${Object.keys(mapping).length} Firebase Storage assets into the staging bucket. Mapping saved in the encrypted-backup directory.`);
