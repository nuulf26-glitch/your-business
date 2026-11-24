import { randomUUID } from 'node:crypto';
import { DbService } from '../src/database';
import { encryptMerchantPaymentSecret } from '../src/merchant-payments';

const describeWithDatabase=process.env.CYB_TEST_BYOG_DB==='1'?describe:describe.skip;
describeWithDatabase('BYOG merchant credential isolation in PostgreSQL',()=>{
  const db=new DbService(),run=randomUUID(),ownerA=`byog-a-${run}`,ownerB=`byog-b-${run}`,pathA=`byog-test:${run}:a`,pathB=`byog-test:${run}:b`,manualPathA=`byog-manual:${run}:a`,manualPathB=`byog-manual:${run}:b`;
  const testEncryptionKey=Buffer.alloc(32,23);
  beforeAll(async()=>{await db.$connect();await db.user.createMany({data:[{id:ownerA,email:`${ownerA}@example.test`},{id:ownerB,email:`${ownerB}@example.test`} ]});});
  afterAll(async()=>{await db.businessRecord.deleteMany({where:{legacyFirebasePath:{in:[pathA,pathB,manualPathA,manualPathB]}}});await db.business.deleteMany({where:{ownerId:{in:[ownerA,ownerB]}}});await db.user.deleteMany({where:{id:{in:[ownerA,ownerB]}}});await db.$disconnect();});
  it('isolates gateway credentials, manual payment configuration and payment-attempt references by merchant',async()=>{
    const businessA=await db.business.create({data:{ownerId:ownerA,name:'BYOG test A',slug:`byog-a-${run}`}}),businessB=await db.business.create({data:{ownerId:ownerB,name:'BYOG test B',slug:`byog-b-${run}`}});
    const secretA='sk_test_merchant_a',secretB='sk_test_merchant_b',encryptedA=encryptMerchantPaymentSecret(secretA,testEncryptionKey),encryptedB=encryptMerchantPaymentSecret(secretB,testEncryptionKey);
    await db.businessRecord.createMany({data:[{businessId:businessA.id,legacyFirebasePath:pathA,type:'merchantPaymentProvider',status:'connected',data:{provider:'tap',mode:'test',...encryptedA}},{businessId:businessB.id,legacyFirebasePath:pathB,type:'merchantPaymentProvider',status:'connected',data:{provider:'tap',mode:'test',...encryptedB}},{businessId:businessA.id,legacyFirebasePath:manualPathA,type:'merchantPaymentManualOptions',status:'active',data:{bankTransfer:{enabled:true,iban:'AE000000000000000000001'}}},{businessId:businessB.id,legacyFirebasePath:manualPathB,type:'merchantPaymentManualOptions',status:'active',data:{bankTransfer:{enabled:true,iban:'AE000000000000000000002'}}}]});
    const configA=await db.businessRecord.findFirst({where:{businessId:businessA.id,type:'merchantPaymentProvider'}}),configB=await db.businessRecord.findFirst({where:{businessId:businessB.id,type:'merchantPaymentProvider'}});
    expect(configA?.businessId).toBe(businessA.id);expect(configB?.businessId).toBe(businessB.id);
    expect(configA?.data).not.toEqual(configB?.data);
    const manualA=await db.businessRecord.findFirst({where:{businessId:businessA.id,type:'merchantPaymentManualOptions'}}),manualB=await db.businessRecord.findFirst({where:{businessId:businessB.id,type:'merchantPaymentManualOptions'}});
    expect((manualA?.data as any)?.bankTransfer?.iban).toBe('AE000000000000000000001');expect((manualB?.data as any)?.bankTransfer?.iban).toBe('AE000000000000000000002');
    await expect(db.businessRecord.create({data:{businessId:businessA.id,legacyFirebasePath:pathA,type:'merchantPayment',status:'starting',data:{provider:'tap'}}})).rejects.toThrow();
  });
});
