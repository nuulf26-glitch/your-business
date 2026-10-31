import { OriginGuard, SessionGuard, tokenHash } from '../src/session';
import { AuthController, BusinessController, HealthController, OrderController } from '../src/routes';
import { publicWebsite, validateWebsite } from '../src/website-policy';
import * as argon2 from 'argon2';

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

  it('accepts a valid session even when the account email is unverified', async () => {
    const session={expiresAt:new Date(Date.now()+60_000),user:{id:'u-1',emailVerifiedAt:null}};
    const db:any={session:{findUnique:jest.fn().mockResolvedValue(session)}};
    const req:any={cookies:{getcyb_session:'session-token'}};
    const context:any={switchToHttp:()=>({getRequest:()=>req})};
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
    await expect(new SessionGuard(db).canActivate(context)).resolves.toBe(true);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
    expect(req.user).toBe(session.user);
  });
});

describe('backend critical operations', () => {
  it('requires explicit terms acceptance before creating an account', async () => {
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn()}};
    await expect(new AuthController(db,{} as any).signup({email:'owner@example.com',password:'a-secure-password',acceptedTerms:false} as any,{cookie:jest.fn()} as any)).rejects.toThrow('Accept the Terms');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('reports an active free trial to the dashboard session', async () => {
    const trialEndsAt=new Date(Date.now()+24*60*60_000);
    const db:any={subscription:{findUnique:jest.fn().mockResolvedValue({status:'TRIALING',trialEndsAt})}};
    const result=await new AuthController(db,{} as any).me({user:{id:'owner-1',email:'owner@example.com',emailVerifiedAt:new Date(),role:'OWNER'}} as any);
    expect(db.subscription.findUnique).toHaveBeenCalledWith({where:{userId:'owner-1'}});
    expect(result).toEqual(expect.objectContaining({paid:false,trialActive:true,trialEndsAt:trialEndsAt.toISOString()}));
  });

  it('loads business records only for the signed-in owner and requested type', async () => {
    const createdAt=new Date('2026-10-26T00:00:00Z');
    const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'owned-business'})},businessRecord:{findMany:jest.fn().mockResolvedValue([{id:'booking-1',type:'bookings',status:'confirmed',read:false,data:{name:'Customer'},createdAt}])}};
    const result=await new BusinessController(db).records({user:{id:'owner-1'},query:{type:'bookings'}} as any);
    expect(db.businessRecord.findMany).toHaveBeenCalledWith({where:{businessId:'owned-business',type:'bookings'},orderBy:{createdAt:'desc'},take:300});
    expect(result).toEqual([{name:'Customer',id:'booking-1',type:'bookings',status:'confirmed',read:false,createdAt:createdAt.toISOString()}]);
  });

  it('reports readiness only after the database answers', async () => {
    const health = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any);
    await expect(health.readiness()).resolves.toEqual({ status: 'ok', database: 'ok' });
  });

  it('does not expose database errors in readiness failures', async () => {
    const health = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('secret connection string')) } as any);
    await expect(health.readiness()).rejects.toThrow('Service Unavailable');
  });

  it('creates a 14-day trial and account without requiring email verification', async () => {
    const user={id:'u-1',email:'owner@example.com',emailVerifiedAt:new Date()};
    const tx:any={user:{create:jest.fn().mockResolvedValue(user)},termsConsent:{create:jest.fn().mockResolvedValue({})},subscription:{create:jest.fn().mockResolvedValue({})},business:{create:jest.fn().mockResolvedValue({})}};
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null)},$transaction:jest.fn(async callback=>callback(tx)),verificationToken:{deleteMany:jest.fn().mockResolvedValue({}),create:jest.fn().mockResolvedValue({})},session:{create:jest.fn().mockResolvedValue({})}};
    const mail:any={sendAccountLink:jest.fn().mockResolvedValue(undefined)};
    const res:any={cookie:jest.fn()};
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';
    const result=await new AuthController(db,mail).signup({email:' OWNER@example.com ',password:'a-secure-password',acceptedTerms:true} as any,res);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({email:'owner@example.com'})}));
    expect(tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:'u-1'})}));
    expect(tx.termsConsent.create).toHaveBeenCalledWith(expect.objectContaining({data:{userId:'u-1',termsVersion:'2026-10-31',privacyVersion:'2026-10-31'}}));
    expect(mail.sendAccountLink).not.toHaveBeenCalled();
    expect(tx.user.create.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(result.emailVerified).toBe(true);
    expect(result.trialEndsAt).toBeTruthy();
  });

  it('allows a valid login when the account email is not verified', async () => {
    const user={id:'u-1',email:'owner@example.com',emailVerifiedAt:null,passwordHash:await argon2.hash('a-secure-password')};
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(user)},session:{create:jest.fn().mockResolvedValue({})}};
    const res:any={cookie:jest.fn()};
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
    const result=await new AuthController(db,{} as any).login({email:'owner@example.com',password:'a-secure-password'} as any,res);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
    expect(result.emailVerified).toBe(false);
    expect(result).not.toHaveProperty('accessToken');
    expect(db.session.create).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
    expect(res.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
    expect(res.cookie.mock.calls[0][2]).toEqual(expect.objectContaining({httpOnly:true,secure:true,sameSite:'none'}));
  });

  it('keeps login validation compatible with older passwords under 12 characters', async () => {
    const user={id:'u-1',email:'owner@example.com',emailVerifiedAt:new Date(),passwordHash:await argon2.hash('short-pass')};
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(user)},session:{create:jest.fn().mockResolvedValue({})}};
    const result=await new AuthController(db,{} as any).login({email:'owner@example.com',password:'short-pass'} as any,{cookie:jest.fn()} as any);
    expect(result.email).toBe('owner@example.com');
  });

  it('returns the same password-reset response for an unknown email', async () => {
    const db:any={user:{findUnique:jest.fn().mockResolvedValue(null)}};
    const result=await new AuthController(db,{} as any).forgotPassword({email:'unknown@example.com'} as any);
    expect(result).toEqual({ok:true,message:'If the account exists, a password reset link will be sent.'});
  });

  it('does not consume an expired password-reset token', async () => {
    const db:any={passwordResetToken:{findUnique:jest.fn().mockResolvedValue({userId:'u-1',expiresAt:new Date(Date.now()-1000)})},$transaction:jest.fn()};
    await expect(new AuthController(db,{} as any).resetPassword({token:'c'.repeat(43),password:'a-new-secure-password'} as any)).rejects.toThrow('invalid or expired');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('reports Google sign-in as unconfigured instead of bypassing provider checks', async () => {
    const previous=process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_ID;
    await expect(new AuthController({} as any,{} as any).googleSignIn({idToken:'a'.repeat(30),acceptedTerms:true} as any,{cookie:jest.fn()} as any)).rejects.toThrow('Google sign-in is not configured');
    if(previous!==undefined)process.env.GOOGLE_CLIENT_ID=previous;
  });

  it('updates the password and invalidates every session when a reset token is consumed', async () => {
    const token='a'.repeat(43), record={userId:'u-1',expiresAt:new Date(Date.now()+60_000)};
    const tx:any={passwordResetToken:{deleteMany:jest.fn().mockResolvedValue({count:1})},user:{update:jest.fn().mockResolvedValue({})},session:{deleteMany:jest.fn().mockResolvedValue({count:2})}};
    const db:any={passwordResetToken:{findUnique:jest.fn().mockResolvedValue(record)},$transaction:jest.fn(callback=>callback(tx))};
    await expect(new AuthController(db,{} as any).resetPassword({token,password:'a-new-secure-password'} as any)).resolves.toEqual({reset:true});
    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tokenHash:tokenHash(token),expiresAt:expect.any(Object)})}));
    expect(tx.session.deleteMany).toHaveBeenCalledWith({where:{userId:'u-1'}});
  });

  it('rejects a reset token after another request has already consumed it', async () => {
    const token='b'.repeat(43), record={userId:'u-1',expiresAt:new Date(Date.now()+60_000)};
    const tx:any={passwordResetToken:{deleteMany:jest.fn().mockResolvedValue({count:0})},user:{update:jest.fn()},session:{deleteMany:jest.fn()}};
    const db:any={passwordResetToken:{findUnique:jest.fn().mockResolvedValue(record)},$transaction:jest.fn(callback=>callback(tx))};
    await expect(new AuthController(db,{} as any).resetPassword({token,password:'a-new-secure-password'} as any)).rejects.toThrow('invalid or expired');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects bearer tokens so sessions are only accepted from HttpOnly cookies', async () => {
    const db:any={session:{findUnique:jest.fn()}};
    const req:any={headers:{authorization:'Bearer test-token'}};
    const context:any={switchToHttp:()=>({getRequest:()=>req})};
    await expect(new SessionGuard(db).canActivate(context)).rejects.toThrow('Sign in required');
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });

  it('rotates an existing browser bearer session into an HttpOnly cookie session', async () => {
    const old={id:'session-1',userId:'u-1',expiresAt:new Date(Date.now()+60_000),user:{id:'u-1',email:'owner@example.com',emailVerifiedAt:new Date(),role:'OWNER'}};
    const tx:any={session:{findUnique:jest.fn().mockResolvedValue(old),deleteMany:jest.fn().mockResolvedValue({count:1}),create:jest.fn().mockResolvedValue({})}};
    const db:any={$transaction:jest.fn(callback=>callback(tx))},res:any={cookie:jest.fn()},previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
    const result=await new AuthController(db,{} as any).migrateLegacySession({sessionToken:'legacy-session-token-value-1234567890'} as any,res);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
    expect(result).toEqual({id:'u-1',email:'owner@example.com',emailVerified:true,role:'OWNER'});
    expect(tx.session.deleteMany).toHaveBeenCalledWith({where:{id:'session-1',expiresAt:expect.objectContaining({gt:expect.any(Date)})}});
    expect(tx.session.create.mock.calls[0][0].data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.cookie).toHaveBeenCalledWith('getcyb_session',expect.any(String),expect.objectContaining({httpOnly:true,secure:true}));
  });

  it('rejects expired session cookies', async () => {
    const db:any={session:{findUnique:jest.fn().mockResolvedValue({expiresAt:new Date(Date.now()-1000),user:{id:'u-1'}})}};
    const req:any={cookies:{getcyb_session:'expired-token'}};
    const context:any={switchToHttp:()=>({getRequest:()=>req})};
    await expect(new SessionGuard(db).canActivate(context)).rejects.toThrow('Session expired');
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
