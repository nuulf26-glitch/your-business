import { createDecipheriv, createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';

const root=path.resolve(process.argv[2]||'');if(!process.argv[2])throw new Error('Usage: node scripts/verify-firebase-export.mjs /absolute/path/to/export');
const keyText=process.env.BACKUP_ENCRYPTION_KEY||'';const key=/^[a-f0-9]{64}$/i.test(keyText)?Buffer.from(keyText,'hex'):Buffer.from(keyText,'base64');if(key.length!==32)throw new Error('Set BACKUP_ENCRYPTION_KEY to the export encryption key.');
function decryptBuffer(data){const iv=data.subarray(0,12),tag=data.subarray(data.length-16),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data.subarray(12,data.length-16)),decipher.final()]);}
async function filesAt(dir){try{return (await fs.readdir(dir,{withFileTypes:true})).flatMap(x=>x.isDirectory()?[]:[path.join(dir,x.name)]);}catch{return [];}}
let docs=0,users=0;
for(const file of await filesAt(path.join(root,'firestore'))){const lines=decryptBuffer(await fs.readFile(file)).toString('utf8').trim().split('\n');for(const line of lines){const row=JSON.parse(line);if(!row.path||!row.id||!('data'in row))throw new Error(`Malformed Firestore row in ${path.basename(file)}`);docs++;}}
for(const file of await filesAt(path.join(root,'auth'))){const rows=JSON.parse(decryptBuffer(await fs.readFile(file)).toString('utf8'));if(!Array.isArray(rows))throw new Error(`Malformed Auth page: ${path.basename(file)}`);users+=rows.length;}
const manifest=JSON.parse(decryptBuffer(await fs.readFile(path.join(root,'storage-manifest.json.enc'))).toString('utf8'));
for(const item of manifest){const blob=path.join(root,'storage',`${String(item.file).padStart(9,'0')}.blob.enc`),stat=await fs.stat(blob);if(stat.size<28)throw new Error(`Truncated encrypted asset ${item.file}`);const handle=await fs.open(blob,'r');const iv=Buffer.alloc(12),tag=Buffer.alloc(16);await handle.read(iv,0,12,0);await handle.read(tag,0,16,stat.size-16);await handle.close();const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);const hash=createHash('sha256');let size=0;const measure=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;hash.update(chunk);callback(null,chunk);}});await pipeline(createReadStream(blob,{start:12,end:stat.size-17}),decipher,measure,new Writable({write(_chunk,_encoding,callback){callback();}}));if(size!==item.size||hash.digest('hex')!==item.sha256)throw new Error(`Firebase Storage checksum failed for encrypted asset ${item.file}`);}
const summary=JSON.parse(await fs.readFile(path.join(root,'summary.json'),'utf8'));if(docs!==summary.documents||users!==summary.authUsers||manifest.length!==summary.storageFiles)throw new Error('Export counts do not match the summary');
console.log(`Verified encrypted backup: ${docs} Firestore documents, ${users} Auth users, ${manifest.length} Storage files; all decryption tags and asset SHA-256 checks passed.`);
