import { Test } from '@nestjs/testing';
import { getStore } from '@netlify/blobs';
import { UploadController } from '../src/routes';
import { MediaStorage } from '../src/media-storage';
import { SessionGuard } from '../src/session';
jest.mock('@netlify/blobs',()=>({getStore:jest.fn()}));
describe('public uploaded media URL',()=>{
 it('stores valid uploads and rejects payloads that exceed the safe Netlify request size',async()=>{
  const store={set:jest.fn().mockResolvedValue(undefined)};
  (getStore as jest.Mock).mockReturnValue(store);
  const module=await Test.createTestingModule({controllers:[UploadController],providers:[{provide:MediaStorage,useValue:{}}]}).overrideGuard(SessionGuard).useValue({canActivate:()=>true}).compile();
  const controller=module.get(UploadController),response={status:jest.fn().mockReturnThis(),json:jest.fn()};
  await controller.upload({user:{id:'owner-id'}} as any,'image/png',{body:Buffer.from([1,2,3])} as any,response as any);
  expect(store.set).toHaveBeenCalledWith(expect.stringMatching(/^businesses\/owner-id\/[a-f0-9]{36}$/),expect.any(ArrayBuffer),expect.objectContaining({metadata:expect.objectContaining({contentType:'image/png'})}));
  expect(response.status).toHaveBeenCalledWith(201);
  await expect(controller.upload({user:{id:'owner-id'}} as any,'video/mp4',{body:Buffer.alloc(4*1024*1024+1)} as any,response as any)).rejects.toThrow('4 MB or smaller');
  await module.close();
 });
 it('serves the same three-part path returned by uploads without corrupting video bytes',async()=>{
  const content=Uint8Array.from([0,255,2,128,65]);
  const store={getMetadata:jest.fn().mockResolvedValue({metadata:{contentType:'video/mp4'}}),get:jest.fn().mockResolvedValue(content.buffer)};
  (getStore as jest.Mock).mockReturnValue(store);
  const module=await Test.createTestingModule({controllers:[UploadController],providers:[{provide:MediaStorage,useValue:{}}]}).overrideGuard(SessionGuard).useValue({canActivate:()=>true}).compile();
  const app=module.createNestApplication();app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
  try{const response=await fetch(`${await app.getUrl()}/api/v1/uploads/businesses/test-user/${'a'.repeat(36)}`);expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('video/mp4');expect(new Uint8Array(await response.arrayBuffer())).toEqual(content);expect(store.get).toHaveBeenCalledWith(`businesses/test-user/${'a'.repeat(36)}`,{type:'arrayBuffer'});}finally{await app.close();}
 });
});
