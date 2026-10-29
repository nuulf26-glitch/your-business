import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base=process.env.CYB_MEDIA_TEST_API_URL||'https://getcyb-staging-api.onrender.com';
if(new URL(base).origin!=='https://getcyb-staging-api.onrender.com')throw Error('Only the confirmed isolated staging API is allowed.');
const origin='https://getcyb-staging-web.onrender.com',evidence=[];
let token;
async function call(path,method='GET',body){
 const result=await fetch(`${base}/api/v1${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const data=await result.json().catch(()=>({}));
 evidence.push({path,method,status:result.status});return {status:result.status,data};
}
const email=`cyb-task2-${Date.now()}@example.com`,password=randomBytes(32).toString('base64url');
const signup=await call('/auth/signup','POST',{email,password,fullName:'Task 2 Storage QA',businessName:'Task 2 Media QA'});
if(signup.status!==201||!signup.data.accessToken)throw Error(`Could not create isolated staging test session (HTTP ${signup.status}).`);
token=signup.data.accessToken;
const status=await call('/uploads/status');
if(!status.data.configured){console.log(JSON.stringify({result:'BLOCKED',reason:'Dedicated S3 staging bucket/credentials are not configured.',evidence},null,2));process.exitCode=2;}
else{
 const dir=mkdtempSync(join(tmpdir(),'cyb-storage-'));
 try{
  const media=[];
  for(const [ext,type,codec] of [['jpg','image/jpeg','mjpeg'],['png','image/png','png'],['webp','image/webp','libwebp'],['mp4','video/mp4','libx264'],['webm','video/webm','libvpx-vp9']]){
   const file=join(dir,`fixture.${ext}`),video=type.startsWith('video/');
   execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=128x96:d=1','-c:v',codec,...(video?['-pix_fmt','yuv420p']:['-frames:v','1']),'-threads','1','-y',file]);
   const bytes=readFileSync(file),checksum=createHash('sha256').update(bytes).digest('base64');
   const auth=await call('/uploads/authorize','POST',{contentType:type,size:bytes.length,checksum});
   if(auth.status!==201)throw Error(`Authorize failed (${type}, HTTP ${auth.status}).`);
   const put=await fetch(auth.data.uploadUrl,{method:'PUT',headers:auth.data.headers,body:bytes});evidence.push({operation:'direct S3 PUT',type,status:put.status});if(!put.ok)throw Error(`S3 PUT failed (HTTP ${put.status}).`);
   const complete=await call(`/uploads/complete/${auth.data.id}`,'POST',{});if(complete.status!==201)throw Error(`Verification failed (${type}, HTTP ${complete.status}).`);
   const read=await fetch(`${base}${complete.data.publicUrl}`);const saved=Buffer.from(await read.arrayBuffer());
   if(!read.ok||!saved.equals(bytes))throw Error('Stored bytes did not match the original.');
   evidence.push({operation:'real object read/integrity',type,status:read.status,bytes:bytes.length});
   if(video){const range=await fetch(`${base}${complete.data.publicUrl}`,{headers:{Range:'bytes=0-63'}});if(range.status!==206)throw Error('Video range playback is unavailable.');evidence.push({operation:'video byte range',type,status:range.status});}
   media.push({id:auth.data.id,type:video?'video':'image',url:`${base}${complete.data.publicUrl}`,width:70,height:240,fit:'contain'});
  }
  const product=await call('/products','POST',{data:{name:'Task 2 QA media product',sellingPrice:10,stock:1,media,imageUrl:media[0].url,status:'active'}});if(product.status!==201)throw Error('Product media save failed.');
  const refreshed=await call('/products');if(!refreshed.data.some(item=>item.id===product.data.id&&item.data.media.length===5))throw Error('Product refresh lost media.');
  const model={brandName:'Task 2 Media QA',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Media persistence QA',media}]}]};
  const save=await call('/websites/draft','PUT',{model});if(save.status!==200)throw Error('Draft save failed.');
  const refresh=await call('/websites/draft');if(refresh.data.draft.pages[0].sections[0].media.length!==5)throw Error('Draft refresh lost media.');
  const publish=await call('/websites/publish','POST',{model});if(publish.status!==201)throw Error('Publish failed.');
  const publicSite=await call(`/websites/public/${publish.data.slug}`);if(publicSite.data.website.pages[0].sections[0].media.length!==5)throw Error('Published media mismatch.');
  console.log(JSON.stringify({result:'API_STORAGE_PASSED_BROWSER_STILL_REQUIRED',evidence},null,2));
 }catch(error){console.log(JSON.stringify({result:'FAILED',message:error.message,evidence},null,2));process.exitCode=1;}finally{rmSync(dir,{recursive:true,force:true});}
}
