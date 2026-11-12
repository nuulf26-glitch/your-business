import { AuthController } from '../src/routes';
import { SessionGuard, tokenHash } from '../src/session';

describe('Google identity validation and cookie session', () => {
  const previous = { ...process.env };
  const originalFetch = global.fetch;
  beforeEach(() => { process.env.GOOGLE_CLIENT_ID = 'authorized-client'; process.env.NODE_ENV = 'production'; });
  afterEach(() => { process.env = { ...previous }; global.fetch = originalFetch; });
  function setup(overrides = {}) {
    const claims = { aud: 'authorized-client', iss: 'https://accounts.google.com', sub: 'google-owner', exp: Math.floor(Date.now()/1000)+300, email_verified: 'true', email: 'owner@example.com', ...overrides };
    global.fetch = jest.fn(async () => ({ok:true,json:async()=>claims})) as any;
    const user = { id: 'owner', email: claims.email, emailVerifiedAt: new Date() };
    const sessions: any[] = [];
    const db: any = {
      googleIdentity: { findUnique: jest.fn(async()=>({user})) },
      user: { findUnique: jest.fn(async()=>null) },
      session: { create: jest.fn(async({data}:any)=>sessions.push(data)), findUnique: jest.fn(async({where}:any)=>{ const s=sessions.find(s=>s.tokenHash===where.tokenHash); return s ? {...s,user} : null; }) },
      $transaction: jest.fn(),
    };
    return { db, controller:new AuthController(db,{} as any) };
  }
  it.each([{aud:'other-client'},{iss:'https://attacker.example'},{sub:''},{exp:0},{email_verified:false},{email:'invalid'}])('rejects invalid identity %j',async(invalid)=>{
    const {db,controller}=setup(invalid);
    await expect(controller.googleSignIn({idToken:'fixture-token'} as any,{cookie:jest.fn()} as any)).rejects.toThrow();
    expect(db.session.create).not.toHaveBeenCalled();
  });
  it('persists an existing Google identity in an HttpOnly secure cookie accepted by SessionGuard',async()=>{
    const {db,controller}=setup(); const res={cookie:jest.fn()};
    await controller.googleSignIn({idToken:'fixture-token',acceptedTerms:false} as any,res as any);
    const [name,token,options]=res.cookie.mock.calls[0];
    expect(name).toBe('getcyb_session'); expect(options).toMatchObject({httpOnly:true,secure:true,sameSite:'lax'});
    expect(db.session.create.mock.calls[0][0].data.tokenHash).toBe(tokenHash(token));
    const req:any={cookies:{getcyb_session:token}};
    await expect(new SessionGuard(db).canActivate({switchToHttp:()=>({getRequest:()=>req})} as any)).resolves.toBe(true);
    expect(req.user.id).toBe('owner');
  });
  it('requires Terms for a new identity without creating user or session records',async()=>{
    const {db,controller}=setup(); db.googleIdentity.findUnique.mockResolvedValue(null);
    await expect(controller.googleSignIn({idToken:'fixture-token',acceptedTerms:false} as any,{cookie:jest.fn()} as any)).rejects.toThrow('Accept the Terms');
    expect(db.$transaction).not.toHaveBeenCalled(); expect(db.session.create).not.toHaveBeenCalled();
  });
  it('does not silently link an existing password account by matching email',async()=>{
    const {db,controller}=setup(); db.googleIdentity.findUnique.mockResolvedValue(null); db.user.findUnique.mockResolvedValue({id:'password-owner'});
    await expect(controller.googleSignIn({idToken:'fixture-token',acceptedTerms:true} as any,{cookie:jest.fn()} as any)).rejects.toThrow('already exists');
    expect(db.session.create).not.toHaveBeenCalled();
  });
});
