import { Test } from '@nestjs/testing';
import { getStore } from '@netlify/blobs';
import { UploadController } from '../src/routes';
import { SessionGuard } from '../src/session';
jest.mock('@netlify/blobs',()=>({getStore:jest.fn()}));
describe('public uploaded media URL',()=>{
 it('serves the same three-part path returned by uploads without corrupting video bytes',async()=>{
  const content=Uint8Array.from([0,255,2,128,65]);
  const store={getMetadata:jest.fn().mockResolvedValue({metadata:{contentType:'video/mp4'}}),get:jest.fn().mockResolvedValue(content.buffer)};
  (getStore as jest.Mock).mockReturnValue(store);
  const module=await Test.createTestingModule({controllers:[UploadController]}).overrideGuard(SessionGuard).useValue({canActivate:()=>true}).compile();
  const app=module.createNestApplication();app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
  try{const response=await fetch(`${await app.getUrl()}/api/v1/uploads/businesses/test-user/${'a'.repeat(36)}`);expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('video/mp4');expect(new Uint8Array(await response.arrayBuffer())).toEqual(content);expect(store.get).toHaveBeenCalledWith(`businesses/test-user/${'a'.repeat(36)}`,{type:'arrayBuffer'});}finally{await app.close();}
 });
});
