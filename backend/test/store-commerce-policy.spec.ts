import { calculateStoreOrderTotals, validateStoreCommerceSettings } from '../src/store-commerce-policy';

describe('merchant storefront commerce settings', () => {
  it('validates merchant-entered zones, tax, and discount limits without assuming a tax rate', () => {
    expect(validateStoreCommerceSettings({
      currency:'AED',
      shippingZones:[{name:'UAE',countryCodes:['AE'],fee:15,freeShippingThreshold:200}],
      taxEnabled:true,taxRatePercent:0,taxShipping:false,
      discounts:[{code:'WELCOME',type:'percent',value:10,usageLimit:20}],
    })).toBeNull();
    expect(validateStoreCommerceSettings({taxRatePercent:101})).toContain('between 0 and 100');
    expect(validateStoreCommerceSettings({shippingZones:[{countryCodes:['UAE'],fee:10}]})).toContain('invalid country code');
    expect(validateStoreCommerceSettings({discounts:[{code:'SAVE',type:'percent',value:101}]})).toContain('invalid value');
  });

  it('calculates shipping, tax, percentage discount, and pickup from merchant settings', () => {
    const settings:any={
      currency:'AED',
      shippingZones:[{name:'UAE',countryCodes:['AE'],fee:15,freeShippingThreshold:200}],
      pickupEnabled:true,taxEnabled:true,taxRatePercent:5,taxShipping:false,
      discounts:[{code:'WELCOME',type:'percent',value:10,enabled:true}],
    };
    expect(calculateStoreOrderTotals(settings,100,{countryCode:'AE',discountCode:'welcome'})).toEqual({
      currency:'AED',subtotal:100,shipping:15,discount:10,tax:4.5,taxLabel:'Tax',total:109.5,discountCode:'WELCOME',
    });
    expect(calculateStoreOrderTotals(settings,100,{deliveryMethod:'pickup'}).shipping).toBe(0);
  });

  it('rejects out-of-zone delivery and exhausted discount codes', () => {
    const settings:any={
      shippingZones:[{countryCodes:['AE'],fee:15}],
      discounts:[{code:'LIMITED',type:'fixed',value:5,usageLimit:1}],
    };
    expect(()=>calculateStoreOrderTotals(settings,50,{countryCode:'US'})).toThrow('does not deliver');
    expect(()=>calculateStoreOrderTotals(settings,50,{countryCode:'AE',discountCode:'LIMITED',discountUses:1})).toThrow('usage limit');
  });

  it('preserves legacy default COD shipping when no shipping zones are configured', () => {
    expect(calculateStoreOrderTotals({},10,{})).toMatchObject({shipping:25,tax:0,discount:0,total:35,currency:'USD'});
  });
});
