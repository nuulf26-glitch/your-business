import { BadRequestException, Body, ConflictException, Controller, Get, Headers, NotFoundException, Param, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { IsIn, IsString, MaxLength, Matches } from 'class-validator';
import { Request } from 'express';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { DbService } from './database';
import { SessionGuard } from './session';

const CREDENTIAL_TYPE = 'merchantPaymentProvider';
const TAP_API = 'https://api.tap.company/v2';
const TAP_COUNTRIES = ['AE'];
const TAP_CURRENCIES: Record<string,string[]> = { AE:['AED'] };
const ENABLED = ['CAPTURED','AUTHORIZED'];
const PAYMENT_COMPLETE = ['CAPTURED'];
const MANUAL_OPTIONS_TYPE = 'merchantPaymentManualOptions';

class TapCredentialInput {
  @IsString() @IsIn(['tap']) provider!: string;
  @IsString() @IsIn(TAP_COUNTRIES) country!: string;
  @IsString() @Matches(/^sk_test_[A-Za-z0-9_-]{8,160}$/) @MaxLength(180) secretKey!: string;
}
class PublicPaymentInput {
  @IsString() @MaxLength(200) token!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{32,128}$/) idempotencyKey!: string;
}
class VerifyPaymentInput { @IsString() @MaxLength(200) token!: string; @IsString() @MaxLength(120) chargeId!: string; }
class RefundInput { @IsString() @MaxLength(40) reason!: string; }
class ManualPaymentInput { @IsString() @MaxLength(200) token!: string; @IsString() @IsIn(['bank_transfer','external_payment_link']) method!: string; }

export function validateExternalPaymentTemplate(value: string) {
  const template=String(value||'').trim();
  if(template.length>500||!template.includes('{amount}')||!template.includes('{order}'))return false;
  try {
    const url=new URL(template.replaceAll('{amount}','12.34').replaceAll('{currency}','AED').replaceAll('{order}','CYB-ORDER-123'));
    return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')&&!/^localhost$|\.(localhost|local|internal|test|example)$/i.test(url.hostname)&&!isIP(url.hostname);
  } catch { return false; }
}
function buildExternalPaymentUrl(template: string, amountCents: number, currency: string, orderId: string) {
  if(!validateExternalPaymentTemplate(template))throw new BadRequestException('External payment URL must be HTTPS and include {amount} and {order} placeholders.');
  const encode=(value:string)=>encodeURIComponent(value);
  return template.replaceAll('{amount}',encode((amountCents/100).toFixed(2))).replaceAll('{currency}',encode(currency)).replaceAll('{order}',encode(orderId));
}

type TapConfiguration = { provider: 'tap'; country: string; mode: 'test'; credentialCiphertext: string; credentialIv: string; credentialTag: string; connectedAt: string; secretLastFour?:string; connectionVerifiedAt?:string };
type TapCharge = { id?: string; status?: string; amount?: number; currency?: string; live_mode?: boolean; transaction?: { created?: string }; reference?: { order?: string; gateway?: string; payment?: string }; redirect?: { url?: string }; response?: { message?: string }; }
export interface MerchantGatewayAdapter {
  createCheckout(secret:string,body:Record<string,unknown>):Promise<any>;
  retrievePayment(secret:string,id:string):Promise<any>;
  refund(secret:string,body:Record<string,unknown>):Promise<any>;
}

function credentialsKey(): Buffer {
  const key = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new BadRequestException('Merchant payment credentials are unavailable until the server encryption key is configured.');
  return Buffer.from(key, 'hex');
}
export function encryptMerchantPaymentSecret(secret: string, key = credentialsKey()) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { credentialCiphertext: ciphertext.toString('base64'), credentialIv: iv.toString('base64'), credentialTag: cipher.getAuthTag().toString('base64') };
}
export function decryptMerchantPaymentSecret(record: Pick<TapConfiguration,'credentialCiphertext'|'credentialIv'|'credentialTag'>, key = credentialsKey()) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.credentialIv,'base64'));
  decipher.setAuthTag(Buffer.from(record.credentialTag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.credentialCiphertext,'base64')),decipher.final()]).toString('utf8');
}
function safeEqual(a: string, b: string) { const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y); }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function tapWebhookHash(payload: any, secret: string) {
  const charge = payload?.object === 'refund' ? payload : payload;
  const values = [charge?.id,charge?.amount,charge?.currency,charge?.reference?.gateway||'',charge?.reference?.payment||'',charge?.status,charge?.transaction?.created||charge?.created];
  if (values.some(value=>value===undefined||value===null)) return '';
  const amount=Number(charge.amount).toFixed(['BHD','KWD','OMR','JOD'].includes(String(charge.currency).toUpperCase())?3:2);
  const canonical=`x_id${charge.id}x_amount${amount}x_currency${charge.currency}x_gateway_reference${charge.reference?.gateway||''}x_payment_reference${charge.reference?.payment||''}x_status${charge.status}x_created${charge.transaction?.created||charge.created}`;
  return createHmac('sha256',secret).update(canonical).digest('hex');
}

export class TapGatewayAdapter implements MerchantGatewayAdapter {
  async request(path: string, secret: string, body?: Record<string,unknown>) {
    let response: globalThis.Response;
    try { response=await fetch(`${TAP_API}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)}); }
    catch { throw new BadRequestException('Tap Payments could not be reached. Retry safely; this order remains unpaid.'); }
    const result=await response.json().catch(()=>({})) as any;
    if(!response.ok){const code=String(result?.errors?.[0]?.code||result?.code||'provider_error');Logger.warn(JSON.stringify({event:'tap_api_failure',status:response.status,code}),'MerchantPayments');const error:any=new Error('Tap could not complete this payment request. Check the provider dashboard or retry.');error.providerStatus=response.status;error.providerCode=code;throw error;}
    return result;
  }
  createCheckout(secret:string, body:Record<string,unknown>) { return this.request('/charges/',secret,body); }
  retrievePayment(secret:string,id:string) { return this.request(`/charges/${encodeURIComponent(id)}`,secret); }
  retrieveCharge(secret:string,id:string) { return this.retrievePayment(secret,id); }
  refund(secret:string,body:Record<string,unknown>) { return this.request('/refunds/',secret,body); }
  retrieveRefund(secret:string,id:string) { return this.request(`/refunds/${encodeURIComponent(id)}`,secret); }
}
export const merchantGatewayAdapters: Readonly<Record<'tap',MerchantGatewayAdapter>> = Object.freeze({tap:new TapGatewayAdapter()});

@Controller('payments/providers')
@UseGuards(SessionGuard)
export class MerchantPaymentSettingsController {
  private tap=new TapGatewayAdapter();
  constructor(private db:DbService){}
  private async business(req:Request & {user:any}) {
    const id=String(req.get('x-cyb-business-id')||'').trim();
    const business=await this.db.business.findFirst({where:id?{id,ownerId:req.user.id}:{ownerId:req.user.id}});
    if(!business)throw new NotFoundException('Business not found');return business;
  }
  private async config(businessId:string,status:any='connected'):Promise<any|null>{return this.db.businessRecord.findFirst({where:{businessId,type:CREDENTIAL_TYPE,status}}).then(row=>row?.data||null);}
  @Get() async list(@Req() req:Request & {user:any}){
    const business=await this.business(req),config=await this.config(business.id);
    const manualRecord=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:MANUAL_OPTIONS_TYPE,status:'active'}}),manual=(manualRecord?.data||{}) as any;
    const records=await this.db.businessRecord.findMany({where:{businessId:business.id,type:'merchantPayment'},orderBy:{createdAt:'desc'},take:100});
    return {commissionPercent:0,providers:[
      {id:'tap',name:'Tap Payments',enabled:true,status:config?'connected':'not_connected',mode:config?.mode||null,country:config?.country||null,currencies:config?TAP_CURRENCIES[config.country]||[]:[],secretConfigured:!!config,secretLastFour:config?.secretLastFour||null,connectionVerified:!!config?.connectionVerifiedAt,platformAuthorization:process.env.TAP_PLATFORM_TEST_APPROVED==='true'?'approved':'required',liveEnabled:false,methods:'Tap hosted checkout displays the methods enabled on the merchant account.'},
      {id:'stripe',name:'Stripe',enabled:false,status:'approval_required',reason:'Direct independent merchant flow for CYB requires account and country eligibility approval.'},
      {id:'paypal',name:'PayPal',enabled:false,status:'approval_required',reason:'Direct merchant integration may be possible; CYB platform eligibility and merchant country rollout are not yet verified.'},
      {id:'paytabs',name:'PayTabs',enabled:false,status:'not_implemented',reason:'Merchant API keys are supported by the provider; CYB platform integration and required approvals still need confirmation.'},
      {id:'amazon_payment_services',name:'Amazon Payment Services',enabled:false,status:'not_implemented',reason:'Merchant hosted checkout is documented; CYB platform onboarding and account eligibility still need confirmation.'},
      {id:'payd',name:'Payd',enabled:false,status:'approval_required',reason:'Merchant accounts are separately approved. API documentation and credentials require contacting Payd; platform and appointed-developer use is not explicitly authorized.'},
      {id:'bank_transfer',name:'Bank transfer',enabled:!!manual.bankTransfer?.enabled,status:manual.bankTransfer?.enabled?'connected':'not_configured',mode:'manual',methods:manual.bankTransfer?.enabled?['Bank transfer']:[]},
      {id:'external_payment_link',name:'External payment link',enabled:!!manual.externalPaymentLink?.enabled,status:manual.externalPaymentLink?.enabled?'connected':'not_configured',mode:'manual',methods:manual.externalPaymentLink?.enabled?['Merchant-provided link']:[]},
      {id:'cash_on_delivery',name:'Cash on delivery',enabled:true,status:'available',mode:'manual',methods:['Cash on delivery']},
    ],manualOptions:{bankTransfer:{enabled:!!manual.bankTransfer?.enabled,bankName:manual.bankTransfer?.bankName||'',accountName:manual.bankTransfer?.accountName||'',iban:manual.bankTransfer?.iban||'',swift:manual.bankTransfer?.swift||''},externalPaymentLink:{enabled:!!manual.externalPaymentLink?.enabled,urlTemplate:manual.externalPaymentLink?.urlTemplate||''}},transactions:records.map(row=>{const d=row.data as any;return {id:row.id,orderId:d.orderId||null,provider:d.provider||'tap',providerPaymentId:d.tapChargeId||null,status:d.status||row.status,amountCents:d.amountCents??null,currency:d.currency||null,createdAt:row.createdAt.toISOString(),refundStatus:d.refundStatus||null,refunds:Array.isArray(d.refunds)?d.refunds:(d.refundId?[{id:d.refundId,status:d.refundStatus,amountCents:d.refundAmountCents}]:[]),mode:d.mode||'test'};})};
  }
  @Post('manual-options') async saveManualOptions(@Req() req:Request & {user:any},@Body() dto:any){
    const business=await this.business(req),bank=dto?.bankTransfer||{},external=dto?.externalPaymentLink||{};
    const bankTransfer={enabled:bank.enabled===true,bankName:String(bank.bankName||'').trim().slice(0,100),accountName:String(bank.accountName||'').trim().slice(0,100),iban:String(bank.iban||'').replace(/\s+/g,'').slice(0,34).toUpperCase(),swift:String(bank.swift||'').trim().slice(0,20).toUpperCase()};
    if(bankTransfer.enabled&&(!bankTransfer.bankName||!bankTransfer.accountName||!/^([A-Z]{2}\d{2}[A-Z0-9]{11,30})$/.test(bankTransfer.iban)))throw new BadRequestException('Enter a bank name, account name, and valid IBAN before enabling bank transfer.');
    const urlTemplate=String(external.urlTemplate||'').trim();
    if(external.enabled===true&&!validateExternalPaymentTemplate(urlTemplate))throw new BadRequestException('Use an HTTPS payment-link template containing {amount} and {order}; {currency} is optional.');
    const externalPaymentLink={enabled:external.enabled===true,urlTemplate:external.enabled===true?urlTemplate:''};
    const data={bankTransfer,externalPaymentLink,updatedAt:new Date().toISOString()};
    await this.db.businessRecord.upsert({where:{legacyFirebasePath:`payment-manual-options:${business.id}`},create:{legacyFirebasePath:`payment-manual-options:${business.id}`,businessId:business.id,type:MANUAL_OPTIONS_TYPE,status:'active',data:data as any},update:{status:'active',data:data as any}});
    return {saved:true,manualOptions:{...data,bankTransfer:{...bankTransfer,enabled:bankTransfer.enabled},externalPaymentLink:{enabled:externalPaymentLink.enabled,urlTemplate:externalPaymentLink.urlTemplate}}};
  }
  @Post('connect') async connect(@Req() req:Request & {user:any},@Body() dto:TapCredentialInput){
    const business=await this.business(req),credential=encryptMerchantPaymentSecret(dto.secretKey);
    const data:TapConfiguration={provider:'tap',country:dto.country,mode:'test',...credential,connectedAt:new Date().toISOString(),secretLastFour:dto.secretKey.slice(-4)} as any;
    await this.db.businessRecord.upsert({where:{legacyFirebasePath:`payment-provider:${business.id}:tap`},create:{legacyFirebasePath:`payment-provider:${business.id}:tap`,businessId:business.id,type:CREDENTIAL_TYPE,status:'connected',data:data as any},update:{status:'connected',data:data as any}});
    return {connected:true,provider:'tap',mode:'test',country:dto.country,secretLastFour:data.secretLastFour,connectionVerified:false,liveEnabled:false};
  }
  @Post('tap/disconnect') async disconnect(@Req() req:Request & {user:any}){
    const business=await this.business(req),config=await this.db.businessRecord.findFirst({where:{legacyFirebasePath:`payment-provider:${business.id}:tap`,businessId:business.id,type:CREDENTIAL_TYPE}});
    if(config)await this.db.businessRecord.update({where:{id:config.id},data:{status:'disconnected',data:{...(config.data as any),disconnectedAt:new Date().toISOString()}}});return {disconnected:true};
  }
  @Post('tap/verify-credentials') async verifyCredentials(@Req() req:Request & {user:any}){
    const business=await this.business(req),config=await this.config(business.id);if(!config)throw new BadRequestException('Connect a Tap test key first.');
    const secret=decryptMerchantPaymentSecret(config),probe=`cyb_invalid_${randomBytes(8).toString('hex')}`;
    try{await this.tap.retrieveCharge(secret,probe);return {verified:true,mode:'test'};}catch(error:any){
      if(error?.providerStatus===404){await this.db.businessRecord.updateMany({where:{legacyFirebasePath:`payment-provider:${business.id}:tap`},data:{data:{...config,connectionVerifiedAt:new Date().toISOString()}}});return {verified:true,mode:'test',note:'Tap authenticated this test key; no payment was created.'};}
      throw new BadRequestException(error?.providerStatus===401?'Tap rejected this test key. Check the key in your Tap dashboard.':'Tap could not verify this test key.');
    }
  }
  @Post('tap/orders/:orderId/refund') async refund(@Req() req:Request & {user:any},@Param('orderId') orderId:string,@Body() dto:RefundInput){
    const business=await this.business(req),order=await this.db.order.findFirst({where:{id:orderId,businessId:business.id}});if(!order)throw new NotFoundException('Order not found');
    const orderData=order.data as any;if(orderData.gatewayProvider!=='tap'||String(orderData.paymentStatus).toLowerCase()!=='paid'||!orderData.providerPaymentId)throw new ConflictException('Only a captured Tap order can be refunded here.');
    const config=await this.config(business.id,{in:['connected','disconnected']});if(!config)throw new ConflictException('Tap credentials are unavailable for this refund.');
    const prior=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'merchantPayment',data:{path:['orderId'],equals:orderId}}});if((prior?.data as any)?.refundStatus==='REFUNDED')return {refunded:true,duplicate:true};
    const secret=decryptMerchantPaymentSecret(config),amountCents=Number(orderData.collectedAmountCents||order.amountCents||0);
    const refund=await this.tap.refund(secret,{charge_id:orderData.providerPaymentId,amount:amountCents/100,currency:String(order.currency).toUpperCase(),reason:['duplicate','fraudulent','requested_by_customer'].includes(dto.reason)?dto.reason:'requested_by_customer',reference:{idempotent:`refund-${hash(`${business.id}:${orderId}`).slice(0,40)}`},post:{url:`${process.env.PUBLIC_API_URL||process.env.PUBLIC_APP_URL||''}/api/v1/payments/providers/tap/webhook`}});
    const refundStatus=String(refund.status||'PENDING').toUpperCase(),now=new Date().toISOString();
    const record=prior?.data as any; if(prior)await this.db.businessRecord.update({where:{id:prior.id},data:{status:refundStatus,data:{...record,refundStatus,refundId:refund.id,refundAmountCents:amountCents,refundUpdatedAt:now}}});
    if(refundStatus==='REFUNDED')await new PublicMerchantPaymentController(this.db).recordProviderRefund(business.id,order.id,{id:orderData.providerPaymentId,amount:amountCents/100,currency:order.currency},refund.id);
    return {accepted:['PENDING','ACCEPTED'].includes(refundStatus),refunded:refundStatus==='REFUNDED',status:refundStatus,refundId:refund.id};
  }
}

@Controller('public/orders')
export class PublicMerchantPaymentController {
  private tap=new TapGatewayAdapter();
  constructor(private db:DbService){}
  private async ownedOrder(id:string,token:string){
    const order=await this.db.order.findUnique({where:{id}}),secretHash=(order?.data as any)?.customerActionTokenHash;
    if(!order||typeof secretHash!=='string'||!/^[a-f0-9]{64}$/i.test(secretHash)||!safeEqual(hash(token),secretHash))throw new NotFoundException('Order not found');
    const business=await this.db.business.findUnique({where:{id:order.businessId}});if(!business)throw new NotFoundException('Store not found');return {order,business,data:order.data as any};
  }
  private async tapConfig(businessId:string){const record=await this.db.businessRecord.findFirst({where:{businessId,type:CREDENTIAL_TYPE,status:{in:['connected','disconnected']}}});const config=record?.data as any;if(!record||!config||config.provider!=='tap'||config.mode!=='test')return null;return {...config,_connectionStatus:record.status} as TapConfiguration & {secretLastFour?:string;_connectionStatus:string};}
  @Get(':id/payment-methods') async methods(@Req() req:Request,@Param('id') id:string){
    const token=String(req.query.token||'');if(token.length<32)throw new NotFoundException('Order not found');const {order,business,data}=await this.ownedOrder(id,token),config=await this.tapConfig(business.id),manualRecord=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:MANUAL_OPTIONS_TYPE,status:'active'}}),manual=(manualRecord?.data||{}) as any;
    const supported=process.env.TAP_PLATFORM_TEST_APPROVED==='true'&&config?._connectionStatus==='connected'&&!!config?.connectionVerifiedAt&&String(data.paymentStatus||'').toLowerCase()!=='paid'&&TAP_CURRENCIES[config.country]?.includes(String(order.currency).toUpperCase());
    const bankEnabled=manual.bankTransfer?.enabled===true,linkEnabled=manual.externalPaymentLink?.enabled===true&&validateExternalPaymentTemplate(manual.externalPaymentLink?.urlTemplate);
    return {methods:[{id:'cash_on_delivery',label:'Cash on delivery',enabled:true},...(bankEnabled?[{id:'bank_transfer',label:'Bank transfer',enabled:true,bankName:manual.bankTransfer.bankName,accountName:manual.bankTransfer.accountName,iban:manual.bankTransfer.iban,swift:manual.bankTransfer.swift||null}]:[]),...(linkEnabled?[{id:'external_payment_link',label:'Pay with external link',enabled:true}]:[]),...(supported?[{id:'tap',label:'Card and wallets via Tap',enabled:true,mode:'test',country:config?.country}]:[])]};
  }
  @Post(':id/payment/manual') async startManualPayment(@Param('id') id:string,@Body() dto:ManualPaymentInput){
    const {order,business,data}=await this.ownedOrder(id,dto.token),manualRecord=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:MANUAL_OPTIONS_TYPE,status:'active'}}),manual=(manualRecord?.data||{}) as any;
    if(String(data.paymentStatus||'').toLowerCase()==='paid')throw new ConflictException('This order has already been paid.');
    if(['cancelled','returned'].includes(String(data.fulfillmentStatus||'').toLowerCase()))throw new ConflictException('This order is cancelled.');
    const amountCents=Number(order.amountCents??Math.round(Number(data.total||0)*100)),currency=String(order.currency||data.currency||'USD').toUpperCase();
    if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw new BadRequestException('This order has no valid amount.');
    const isBank=dto.method==='bank_transfer',option=isBank?manual.bankTransfer:manual.externalPaymentLink;
    if(option?.enabled!==true)throw new BadRequestException('This manual payment method is not configured for this store.');
    const reference=`CYB-${order.id}`.slice(0,64),url=isBank?null:buildExternalPaymentUrl(String(option.urlTemplate),amountCents,currency,reference);
    const legacyFirebasePath=`manual-payment:${business.id}:${order.id}`;
    const output={provider:dto.method,orderId:order.id,amountCents,currency,reference,status:'awaiting_confirmation',...(isBank?{bankTransfer:{bankName:option.bankName,accountName:option.accountName,iban:option.iban,swift:option.swift||null}}:{url})};
    return this.db.$transaction(async tx=>{
      const prior=await tx.businessRecord.findUnique({where:{legacyFirebasePath}});
      if(prior){const saved=prior.data as any;if(saved.provider!==dto.method)throw new ConflictException('A different manual payment method is already pending for this order.');return saved;}
      const changed=await tx.order.updateMany({where:{id:order.id,businessId:business.id,status:order.status,data:{equals:order.data as any}},data:{data:{...data,paymentMethod:dto.method,paymentStatus:'Awaiting manual confirmation',manualPaymentReference:reference,manualPaymentProvider:dto.method} as any}});
      if(!changed.count)throw new ConflictException('Order changed while this payment option was being selected.');
      await tx.businessRecord.create({data:{legacyFirebasePath,businessId:business.id,type:'merchantPayment',status:'awaiting_confirmation',data:output as any}});
      return output;
    });
  }
  @Post(':id/payment/tap') async startTap(@Req() req:Request,@Param('id') id:string,@Body() dto:PublicPaymentInput){
    const {order,business,data}=await this.ownedOrder(id,dto.token),config=await this.tapConfig(business.id);
    if(process.env.TAP_PLATFORM_TEST_APPROVED!=='true')throw new BadRequestException('Tap requires account-manager approval for CYB platform integration before merchant checkout can be enabled.');
    if(config?._connectionStatus!=='connected'||!config?.connectionVerifiedAt)throw new BadRequestException('Connect and verify your Tap test account before enabling this checkout method.');
    if(!TAP_CURRENCIES[config.country]?.includes(String(order.currency).toUpperCase()))throw new BadRequestException('Tap test payments are not enabled for this store currency.');
    if(String(data.paymentStatus||'').toLowerCase()==='paid')throw new ConflictException('This order has already been paid.');
    if(['cancelled','returned'].includes(String(data.fulfillmentStatus||'').toLowerCase()))throw new ConflictException('This order is cancelled.');
    const idem=`tap-checkout:${business.id}:${order.id}`,prior=await this.db.businessRecord.findUnique({where:{legacyFirebasePath:idem}});
    if(prior){const existing=prior.data as any;if(existing.checkoutUrl)return {url:existing.checkoutUrl,chargeId:existing.tapChargeId,mode:'test'};throw new ConflictException('Payment attempt is already being prepared. Retry in a moment.');}
    const secret=decryptMerchantPaymentSecret(config),publicUrl=process.env.PUBLIC_APP_URL||'';
    if(!/^https:\/\//.test(publicUrl))throw new BadRequestException('Public checkout URL is not configured.');
    let record:any;try{record=await this.db.businessRecord.create({data:{legacyFirebasePath:idem,businessId:business.id,type:'merchantPayment',status:'starting',data:{provider:'tap',mode:'test',orderId:order.id,amountCents:order.amountCents,currency:order.currency,status:'starting',idempotencyHash:hash(dto.idempotencyKey)} as any}});}catch{const concurrent=await this.db.businessRecord.findUnique({where:{legacyFirebasePath:idem}});const concurrentData=concurrent?.data as any;if(concurrentData?.checkoutUrl)return {url:concurrentData.checkoutUrl,chargeId:concurrentData.tapChargeId,mode:'test'};throw new ConflictException('A payment attempt is already being prepared. Retry in a moment.');}
    try{
      const fullName=String(data.customerName||'Customer').trim().split(/\s+/),phoneDigits=String(data.phone||'').replace(/\D/g,'');
      const countryCode={AE:'971',SA:'966',KW:'965',QA:'974',BH:'973',OM:'968'}[config.country]||'971';
      const created=await this.tap.createCheckout(secret,{amount:Number(order.amountCents)/100,currency:String(order.currency).toUpperCase(),threeDSecure:true,customer_initiated:true,description:`Store order ${order.id}`,reference:{order:order.id,idempotent:`order-${hash(`${business.id}:${order.id}`).slice(0,40)}`},customer:{first_name:fullName[0]||'Customer',last_name:fullName.slice(1).join(' ')||'Customer',email:String(data.email||''),phone:{country_code:countryCode,number:phoneDigits.slice(-12)}},source:{id:'src_all'},redirect:{url:`${publicUrl.replace(/\/$/,'')}/payment?tap_order=${encodeURIComponent(order.id)}`},post:{url:`${process.env.PUBLIC_API_URL||publicUrl.replace(/\/$/,'')}/api/v1/payments/providers/tap/webhook`},metadata:{cyb_order_id:order.id}});
      const checkoutUrl=String(created?.transaction?.url||created?.redirect?.url||'');if(!created.id||!/^https:\/\/.*tap\.company\//i.test(checkoutUrl))throw new BadRequestException('Tap did not return a valid hosted test checkout URL.');
      await this.db.businessRecord.update({where:{id:record.id},data:{status:String(created.status||'INITIATED'),data:{provider:'tap',mode:'test',orderId:order.id,tapChargeId:created.id,checkoutUrl,amountCents:order.amountCents,currency:order.currency,status:String(created.status||'INITIATED'),createdAt:new Date().toISOString()}}});
      return {url:checkoutUrl,chargeId:created.id,mode:'test'};
    }catch(error){await this.db.businessRecord.update({where:{id:record.id},data:{status:'failed',data:{provider:'tap',mode:'test',orderId:order.id,status:'failed',failedAt:new Date().toISOString()}}}).catch(()=>{});throw error;}
  }
  @Post(':id/payment/tap/verify') async verifyTap(@Req() req:Request,@Param('id') id:string,@Body() dto:VerifyPaymentInput){
    const {order,business,data}=await this.ownedOrder(id,dto.token),record=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'merchantPayment',data:{path:['tapChargeId'],equals:dto.chargeId}}});
    if(!record||(record.data as any)?.orderId!==order.id)throw new NotFoundException('Payment reference not found');const config=await this.tapConfig(business.id);if(!config)throw new NotFoundException('Payment provider not found');
    const charge=await this.tap.retrieveCharge(decryptMerchantPaymentSecret(config),dto.chargeId);
    const valid=charge.id===dto.chargeId&&charge.reference?.order===order.id&&Math.round(Number(charge.amount)*100)===Number(order.amountCents)&&String(charge.currency).toUpperCase()===String(order.currency).toUpperCase()&&charge.live_mode===false;
    if(!valid)throw new BadRequestException('Tap payment details do not match this order.');
    if(PAYMENT_COMPLETE.includes(String(charge.status).toUpperCase()))await this.recordCapturedOrder(business.id,order.id,charge,false);
    return {verified:PAYMENT_COMPLETE.includes(String(charge.status).toUpperCase()),status:charge.status||'PENDING',orderId:order.id};
  }
  @Post(':id/payment/tap/cancel') async cancelTap(@Req() req:Request,@Param('id') id:string,@Body() dto:VerifyPaymentInput){
    const {order,business}=await this.ownedOrder(id,dto.token),record=await this.db.businessRecord.findFirst({where:{businessId:business.id,type:'merchantPayment',data:{path:['tapChargeId'],equals:dto.chargeId}}});if(!record||(record.data as any)?.orderId!==order.id)throw new NotFoundException('Payment reference not found');
    const charge=await this.tap.retrieveCharge(decryptMerchantPaymentSecret(await this.tapConfig(business.id) as any),dto.chargeId);
    if(ENABLED.includes(String(charge.status).toUpperCase()))return {cancelled:false,status:charge.status};
    return {cancelled:true,status:charge.status||'FAILED'};
  }
  async handleWebhook(req:Request,signature:string){
    const payload=(req as any).body;if(!payload||typeof payload!=='object'||!payload.id)throw new BadRequestException('Invalid Tap webhook.');
    const lookupId=String(payload.object==='refund'?payload.charge_id:payload.id||'');
    const record=await this.db.businessRecord.findFirst({where:{type:'merchantPayment',data:{path:['tapChargeId'],equals:lookupId}}});if(!record)return {received:true,ignored:true};
    const config=await this.tapConfig(record.businessId);if(!config)throw new NotFoundException('Payment provider not found.');const secret=decryptMerchantPaymentSecret(config),expected=tapWebhookHash(payload,secret);
    if(!expected||!signature||!safeEqual(expected.toLowerCase(),signature.toLowerCase()))throw new BadRequestException('Invalid Tap webhook signature.');
    const fresh=payload.object==='refund'?await this.tap.retrieveRefund(secret,String(payload.id)):await this.tap.retrieveCharge(secret,String(payload.id)),recordData=record.data as any;
    const charge=payload.object==='refund'?await this.tap.retrieveCharge(secret,lookupId):fresh;
    if(charge.live_mode!==false||charge.reference?.order!==recordData.orderId||Math.round(Number(charge.amount)*100)!==Number(recordData.amountCents)||String(charge.currency).toUpperCase()!==String(recordData.currency).toUpperCase())throw new BadRequestException('Tap webhook does not match the stored payment.');
    const eventId=`tap-event:${hash(`${record.businessId}:${fresh.id}:${fresh.status}`)}`,existing=await this.db.businessRecord.findUnique({where:{legacyFirebasePath:eventId}});if(existing)return {received:true,duplicate:true};
    await this.db.businessRecord.create({data:{legacyFirebasePath:eventId,businessId:record.businessId,type:'merchantPaymentEvent',status:String(fresh.status||'unknown'),data:{provider:'tap',tapChargeId:charge.id,eventStatus:fresh.status,receivedAt:new Date().toISOString()}}});
    if(PAYMENT_COMPLETE.includes(String(charge.status).toUpperCase()))await this.recordCapturedOrder(record.businessId,String(recordData.orderId),charge,false);
    if(payload.object==='refund'&&String(fresh.status).toUpperCase()==='REFUNDED')await this.recordCapturedOrder(record.businessId,String(recordData.orderId),{...charge,amount:recordData.amountCents/100},true,String(fresh.id));
    const refunds=payload.object==='refund'?[...(Array.isArray(recordData.refunds)?recordData.refunds:[]),{id:fresh.id,status:fresh.status,amountCents:Math.round(Number(fresh.amount)*100),updatedAt:new Date().toISOString()}]:recordData.refunds;
    await this.db.businessRecord.update({where:{id:record.id},data:{status:String(charge.status||record.status),data:{...recordData,status:String(charge.status||record.status),...(payload.object==='refund'?{refundStatus:fresh.status,refunds}:{}),updatedAt:new Date().toISOString()}}});return {received:true};
  }
  private async recordCapturedOrder(businessId:string,orderId:string,charge:TapCharge,refunded:boolean,refundId?:string){
    return this.db.$transaction(async tx=>{
      const order=await tx.order.findFirst({where:{id:orderId,businessId}});if(!order)throw new NotFoundException('Order not found');const data=order.data as any;
      if(!refunded&&String(data.paymentStatus||'').toLowerCase()==='paid')return {updated:false,duplicate:true};
      if(refunded&&String(data.paymentStatus||'').toLowerCase()==='refunded')return {updated:false,duplicate:true};
      const expected=Number(order.amountCents),amountCents=Math.round(Number(charge.amount)*100);if(expected!==amountCents||String(order.currency).toUpperCase()!==String(charge.currency).toUpperCase())throw new BadRequestException('Provider amount differs from this order.');
      const now=new Date().toISOString(),history=Array.isArray(data.paymentHistory)?data.paymentHistory:[],refundHistory=Array.isArray(data.refundHistory)?data.refundHistory:[];
      const next={...data,paymentMethod:'tap',gatewayProvider:'tap',providerPaymentId:charge.id,paymentStatus:refunded?'Refunded':'Paid',...(refunded?{refundedAt:now,refundHistory:[...refundHistory,{id:refundId,amountCents,recordedAt:now,status:'REFUNDED'}],paymentHistory:[...history,{type:'refund',amountCents,recordedAt:now,provider:'tap'}]}:{paidAt:now,collectedAmountCents:amountCents,paymentHistory:[...history,{type:'collected',amountCents,recordedAt:now,method:'tap',providerPaymentId:charge.id}]})};
      const changed=await tx.order.updateMany({where:{id:orderId,businessId,status:order.status,data:{equals:order.data as any}},data:{data:next as any}});if(!changed.count)throw new ConflictException('Order changed while payment was being recorded.');
      const email=String(next.email||'').trim().toLowerCase();if(email){const customer=await tx.customer.findFirst({where:{businessId,data:{path:['email'],equals:email}}});if(customer){const orders=await tx.order.findMany({where:{businessId}}),matching=orders.filter((row:any)=>String((row.data as any)?.email||'').trim().toLowerCase()===email),paid=matching.filter((row:any)=>['paid','refunded'].includes(String((row.data as any)?.paymentStatus||'').toLowerCase()));const spent=paid.reduce((n:number,row:any)=>n+Number((row.data as any)?.collectedAmountCents||0),0),refundedCents=paid.reduce((n:number,row:any)=>n+(Array.isArray((row.data as any)?.refundHistory)?(row.data as any).refundHistory.reduce((s:number,item:any)=>s+Number(item.amountCents||0),0):0),0);await tx.customer.update({where:{id:customer.id},data:{data:{...(customer.data as any),totalSpent:Math.max(0,spent-refundedCents)/100,paidOrders:paid.filter((row:any)=>String((row.data as any)?.paymentStatus).toLowerCase()==='paid').length,orders:matching.length} as any}});}}
      return {updated:true};
    });
  }
  async recordProviderRefund(businessId:string,orderId:string,charge:TapCharge,refundId:string){return this.recordCapturedOrder(businessId,orderId,charge,true,refundId);}
}

@Controller('payments/providers/tap')
export class TapMerchantWebhookController {
  private delegate:PublicMerchantPaymentController;
  constructor(db:DbService){this.delegate=new PublicMerchantPaymentController(db);}
  @Post('webhook') async webhook(@Req() req:Request,@Headers('hashstring') signature:string){return this.delegate.handleWebhook(req,signature);}
}
