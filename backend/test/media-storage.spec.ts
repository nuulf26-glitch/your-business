import { Test } from '@nestjs/testing';
import { MediaStorage, validateUpload, matchesSignature, validateProbe, assertOwnedMedia, IMAGE_LIMIT, VIDEO_LIMIT } from '../src/media-storage';
import { UploadController } from '../src/routes';
import { DbService } from '../src/database';
import { SessionGuard } from '../src/session';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const checksum=Buffer.alloc(32).toString('base64');

describe('direct media storage policy',()=>{
 it('accepts practical image/video boundaries and rejects unsupported or empty media',()=>{
  expect(validateUpload('image/png',IMAGE_LIMIT,checksum).size).toBe(IMAGE_LIMIT);
  expect(validateUpload('video/mp4',VIDEO_LIMIT,checksum).size).toBe(VIDEO_LIMIT);
  for(const [type,size] of [['video/mp4',VIDEO_LIMIT+1],['image/png',IMAGE_LIMIT+1],['video/quicktime',100],['image/svg+xml',100],['image/png',0],['image/png',1.5]])expect(()=>validateUpload(type,size,checksum)).toThrow();
  expect(()=>validateUpload('image/png',100,'invalid')).toThrow('checksum');
 });
 it('rejects file extension/type spoofing and incompatible video codecs',()=>{
  expect(matchesSignature(Buffer.from('<script>alert(1)</script>'),'image/png')).toBe(false);
  expect(()=>validateProbe({streams:[{codec_type:'video',codec_name:'hevc',width:640,height:480}]},'video/mp4')).toThrow('Unsupported video codec');
  expect(()=>validateProbe({streams:[]},'video/mp4')).toThrow('damaged');
  expect(()=>validateProbe({streams:[{codec_type:'video',width:10000,height:10000}]},'image/png')).toThrow('40 megapixels');
 });
 it('prevents cross-account attachment, while preserving legacy/external media',async()=>{
  const db:any={mediaAsset:{count:jest.fn().mockResolvedValue(0)}};
  const value={media:[{url:'/api/v1/uploads/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]};
  await expect(assertOwnedMedia(db,'owner',value)).rejects.toThrow('another account');
  expect(db.mediaAsset.count).toHaveBeenCalledWith({where:{id:{in:['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']},ownerId:'owner',status:'READY'}});
  await expect(assertOwnedMedia(db,'owner',{image:'https://example.com/old.jpg'})).resolves.toBeUndefined();
 });
 it('does not reveal or finalize uploads owned by another account',async()=>{
  const db:any={mediaAsset:{findFirst:jest.fn().mockResolvedValue(null)}};
  await expect(new MediaStorage(db).complete('other','id')).rejects.toThrow('Upload not found');
  expect(db.mediaAsset.findFirst).toHaveBeenCalledWith({where:{id:'id',ownerId:'other'}});
 });
 it('returns the existing immutable URL on repeated finalization',async()=>{
  const db:any={mediaAsset:{findFirst:jest.fn().mockResolvedValue({id:'id',status:'READY'})}};
  await expect(new MediaStorage(db).complete('owner','id')).resolves.toEqual({id:'id',publicUrl:'/api/v1/uploads/media/id'});
 });
});

describe('original HTTP 500 regression: missing object storage',()=>{
 it('returns actionable HTTP 503 without entering Netlify Blobs or touching database records',async()=>{
  const original={...process.env};delete process.env.S3_BUCKET;
  const db:any={$transaction:jest.fn()};
  const module=await Test.createTestingModule({controllers:[UploadController],providers:[MediaStorage,{provide:DbService,useValue:db}]}).overrideGuard(SessionGuard).useValue({canActivate:(ctx:any)=>{ctx.switchToHttp().getRequest().user={id:'owner'};return true;}}).compile();
  const app=module.createNestApplication();app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
  try{
   const result=await fetch(`${await app.getUrl()}/api/v1/uploads/authorize`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentType:'image/png',size:100,checksum})});
   expect(result.status).toBe(503);expect((await result.json() as any).message).toContain('storage is not configured');expect(db.$transaction).not.toHaveBeenCalled();
   const status=await fetch(`${await app.getUrl()}/api/v1/uploads/status`);expect((await status.json() as any).configured).toBe(false);
  }finally{await app.close();process.env=original;}
 });
});

// Real codec/parser checks. These create local fixtures; no object storage is mocked or used here.
describe('real FFmpeg/ffprobe media validation',()=>{
 it('decodes JPEG, PNG, WebP, H.264 MP4 and VP9 WebM fixtures',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cyb-codecs-'));
  try{
   for(const [ext,type,codec] of [['jpg','image/jpeg','mjpeg'],['png','image/png','png'],['webp','image/webp','libwebp'],['mp4','video/mp4','libx264'],['webm','video/webm','libvpx-vp9']]){
    const file=join(dir,`test.${ext}`),video=type.startsWith('video/');
    execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=128x96:d=1','-c:v',codec,...(video?['-pix_fmt','yuv420p']:['-frames:v','1']),'-threads','1','-y',file]);
    expect(matchesSignature(readFileSync(file).subarray(0,64),type)).toBe(true);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',file],{encoding:'utf8'}));
    expect(validateProbe(probe,type)).toEqual({width:128,height:96});
   }
  }finally{rmSync(dir,{recursive:true,force:true});}
 },30000);
});

describe('real AWS SDK signature construction (no storage network)',()=>{
 it('binds signed uploads to exact type, length, checksum, temporary key and short lifetime',async()=>{
  const original={...process.env};Object.assign(process.env,{S3_BUCKET:'isolated-test-bucket',S3_REGION:'us-east-1',S3_ACCESS_KEY_ID:'test-only-access-key',S3_SECRET_ACCESS_KEY:'test-only-secret-key'});delete process.env.S3_ENDPOINT;
  const tx:any={$queryRaw:jest.fn(),mediaAsset:{aggregate:jest.fn().mockResolvedValue({_sum:{size:0},_count:0}),create:jest.fn().mockImplementation(({data})=>Promise.resolve(data))}};
  const db:any={$transaction:(fn:any)=>fn(tx)};
  try{
   const result=await new MediaStorage(db).authorize('owner',{contentType:'video/mp4',size:1234,checksum});
   const url=new URL(result.uploadUrl),signed=url.searchParams.get('X-Amz-SignedHeaders');
   expect(signed).toContain('content-length');expect(signed).toContain('content-type');expect(signed).toContain('x-amz-checksum-sha256');
   expect(url.searchParams.get('X-Amz-Expires')).toBe('900');expect(url.pathname).toBe(`/incoming/${result.id}`);
   expect(result.headers).toEqual({'Content-Type':'video/mp4','x-amz-checksum-sha256':checksum});
   expect(tx.mediaAsset.create.mock.calls[0][0].data.objectKey).toBe(`media/owner/${result.id}`);
  }finally{process.env=original;}
 });
});
