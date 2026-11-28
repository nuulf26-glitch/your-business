import { MailService } from '../src/mail';

const keys=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','MAIL_FROM'] as const;
function withEnv(values:Record<string,string|undefined>,run:()=>Promise<void>) {
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  for(const key of keys)if(values[key]===undefined)delete process.env[key];else process.env[key]=values[key];
  return run().finally(()=>{for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];});
}

describe('staging SMTP diagnostics',()=>{
  it('reports missing variable names only, without attempting a connection',async()=>withEnv({SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'587',SMTP_USER:'sender@example.com',SMTP_PASSWORD:'',MAIL_FROM:undefined},async()=>{
    const service=new MailService();
    await expect(service.verifySmtp()).resolves.toEqual(expect.objectContaining({configured:false,missing:['SMTP_PASSWORD'],passwordConfigured:false,authenticated:false,failure:'missing_configuration'}));
  }));

  it('confirms authenticated SMTP using flags only and never returns credential values',async()=>withEnv({SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'587',SMTP_USER:'sender@example.com',SMTP_PASSWORD:'test-secret',MAIL_FROM:'sender@example.com'},async()=>{
    const service:any=new MailService();service.transporter={verify:jest.fn().mockResolvedValue(true)};
    const result=await service.verifySmtp();
    expect(result).toEqual({configured:true,missing:[],gmailHost:true,supportedPort:true,smtpUserConfigured:true,passwordConfigured:true,mailFromConfigured:true,authenticated:true,failure:null});
    expect(JSON.stringify(result)).not.toContain('test-secret');
    expect(JSON.stringify(result)).not.toContain('sender@example.com');
  }));

  it('categorizes SMTP authentication failures without returning provider text',async()=>withEnv({SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'587',SMTP_USER:'sender@example.com',SMTP_PASSWORD:'test-secret',MAIL_FROM:undefined},async()=>{
    const service:any=new MailService();service.transporter={verify:jest.fn().mockRejectedValue(Object.assign(new Error('credentials rejected: test-secret'),{code:'EAUTH',responseCode:535}))};
    const result=await service.verifySmtp();
    expect(result).toEqual(expect.objectContaining({authenticated:false,failure:'authentication_failed',errorCode:'EAUTH',responseCode:535}));
    expect(JSON.stringify(result)).not.toContain('test-secret');
    expect(JSON.stringify(result)).not.toContain('credentials rejected');
  }));
});
