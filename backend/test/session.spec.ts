import { OriginGuard, tokenHash } from '../src/session';
import { AuthController, HealthController, OrderController } from '../src/routes';
import { publicWebsite, validateWebsite } from '../src/website-policy';

describe('opaque session token storage', () => {
  it('stores a deterministic digest instead of the bearer token', () => {
    const token = 'sample-random-session-token';
    const digest = tokenHash(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(tokenHash(token)).toBe(digest);
  });

  it('produces different digests for different tokens', () => {
    expect(tokenHash('token-a')).not.toBe(tokenHash('token-b'));
  });

  it('rejects browser writes from an untrusted origin', () => {
    const previous=process.env.FRONTEND_ORIGIN;process.env.FRONTEND_ORIGIN='https://getcyb.fit';
    const context:any={switchToHttp:()=>({getRequest:()=>({method:'POST',headers:{origin:'https://attacker.example'}})})};
    expect(()=>new OriginGuard().canActivate(context)).toThrow('Request origin is not allowed');
    if(previous===undefined)delete process.env.FRONTEND_ORIGIN;else process.env.FRONTEND_ORIGIN=previous;
  });
});

describe('backend critical operations', () => {
  it('reports readiness only after the database answers', async () => {
    const health = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any);
    await expect(health.readiness()).resolves.toEqual({ status: 'ok', database: 'ok' });
  });

  it('does not expose database errors in readiness failures', async () => {
    const health = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('secret connection string')) } as any);
    await expect(health.readiness()).rejects.toThrow('Service Unavailable');
  });

  it('creates a 14-day trial and sends only a one-time verification link at signup', async () => {
    const user={id:'u-1',email:'owner@example.com',emailVerifiedAt:null};
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue(user),delete:jest.fn().mockResolvedValue(user)},subscription:{create:jest.fn().mockResolvedValue({})},business:{create:jest.fn().mockResolvedValue({})},verificationToken:{deleteMany:jest.fn().mockResolvedValue({}),create:jest.fn().mockResolvedValue({})},session:{create:jest.fn().mockResolvedValue({})}};
    const mail:any={sendAccountLink:jest.fn().mockResolvedValue(undefined)};
    const res:any={cookie:jest.fn()};
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';
    const result=await new AuthController(db,mail,{} as any).signup({email:' OWNER@example.com ',password:'a-secure-password'} as any,res);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({email:'owner@example.com'})}));
    expect(db.subscription.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:'u-1'})}));
    expect(mail.sendAccountLink).toHaveBeenCalledWith('owner@example.com',expect.any(String),'verify');
    expect(result.emailVerified).toBe(false);
    expect(result.trialEndsAt).toBeTruthy();
  });

  it('scopes order updates to the signed-in owner business', async () => {
    const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'business-owned'})},order:{updateMany:jest.fn().mockResolvedValue({count:0}),findUnique:jest.fn()}};
    await expect(new OrderController(db).updateStatus({user:{id:'owner-1'},params:{id:'another-business-order'}} as any,{status:'delivered'} as any)).rejects.toThrow('Order not found');
    expect(db.order.updateMany).toHaveBeenCalledWith({where:{id:'another-business-order',businessId:'business-owned'},data:{status:'delivered'}});
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unsafe published links and strips private root fields', () => {
    const model={brandName:'GETCYB Store',privateOwnerEmail:'owner@example.com',pages:[{id:'home',slug:'',sections:[{id:'cta',type:'button',href:'javascript:alert(1)'}]}]};
    expect(()=>validateWebsite(model,true)).toThrow('safe link');
    const safe={...model,pages:[{id:'home',slug:'',sections:[{id:'cta',type:'button',href:'https://example.com'}]}]};
    expect(publicWebsite(validateWebsite(safe,true))).not.toHaveProperty('privateOwnerEmail');
  });
});
