export type StoreCommerceSettings = {
  currency?: string;
  shippingZones?: Array<{ name?: string; countryCodes: string[]; fee: number; freeShippingThreshold?: number | null; enabled?: boolean }>;
  pickupEnabled?: boolean;
  taxEnabled?: boolean;
  taxRatePercent?: number;
  taxShipping?: boolean;
  taxLabel?: string;
  discounts?: Array<{ code: string; type: 'percent' | 'fixed'; value: number; enabled?: boolean; startsAt?: string; endsAt?: string; usageLimit?: number | null }>;
};

const allowedCurrencies=new Set(['AED','USD','EUR','GBP']);
function nonNegative(value: unknown) { const number=Number(value);return Number.isFinite(number)&&number>=0; }

export function validateStoreCommerceSettings(value: Record<string, any>): string | null {
  if(value.currency!==undefined&&!allowedCurrencies.has(String(value.currency).toUpperCase()))return 'Choose a supported store currency';
  if(value.shippingZones!==undefined){
    if(!Array.isArray(value.shippingZones)||value.shippingZones.length>50)return 'Shipping zones must be a list of up to 50 zones';
    for(const [index,zone] of value.shippingZones.entries()){
      if(!zone||typeof zone!=='object'||!Array.isArray(zone.countryCodes)||!zone.countryCodes.length)return `Shipping zone ${index+1} must include at least one country code`;
      if(zone.countryCodes.some((code:unknown)=>!/^[A-Z]{2}$/.test(String(code))))return `Shipping zone ${index+1} contains an invalid country code`;
      if(!nonNegative(zone.fee))return `Shipping zone ${index+1} fee must be non-negative`;
      if(zone.freeShippingThreshold!==undefined&&zone.freeShippingThreshold!==null&&!nonNegative(zone.freeShippingThreshold))return `Shipping zone ${index+1} threshold must be non-negative`;
    }
  }
  if(value.taxRatePercent!==undefined&&(!Number.isFinite(Number(value.taxRatePercent))||Number(value.taxRatePercent)<0||Number(value.taxRatePercent)>100))return 'Tax rate must be between 0 and 100 percent';
  if(value.discounts!==undefined){
    if(!Array.isArray(value.discounts)||value.discounts.length>100)return 'Discount codes must be a list of up to 100 codes';
    const seen=new Set<string>();
    for(const [index,discount] of value.discounts.entries()){
      const code=String(discount?.code||'').trim().toUpperCase();
      if(!/^[A-Z0-9_-]{3,40}$/.test(code))return `Discount ${index+1} needs a 3–40 character code`;
      if(seen.has(code))return 'Discount codes must be unique';
      seen.add(code);
      if(!['percent','fixed'].includes(discount.type))return `Discount ${index+1} type must be percent or fixed`;
      if(!nonNegative(discount.value)||(discount.type==='percent'&&Number(discount.value)>100))return `Discount ${index+1} has an invalid value`;
      if(discount.usageLimit!==undefined&&discount.usageLimit!==null&&(!Number.isInteger(Number(discount.usageLimit))||Number(discount.usageLimit)<1))return `Discount ${index+1} usage limit must be a positive whole number`;
      for(const field of ['startsAt','endsAt']){
        if(discount[field]!==undefined&&discount[field]!==null&&discount[field]!==''&&!Number.isFinite(Date.parse(String(discount[field]))))return `Discount ${index+1} ${field} is invalid`;
      }
      if(discount.startsAt&&discount.endsAt&&Date.parse(discount.endsAt)<Date.parse(discount.startsAt))return `Discount ${index+1} end date must be after its start date`;
    }
  }
  return null;
}

export function calculateStoreOrderTotals(settings: StoreCommerceSettings, subtotal: number, input: { countryCode?: string; deliveryMethod?: string; discountCode?: string; discountUses?: number }) {
  const currency=String(settings.currency||'USD').toUpperCase();
  let shipping=0;
  const zones=Array.isArray(settings.shippingZones)?settings.shippingZones.filter(zone=>zone.enabled!==false):[];
  const method=String(input.deliveryMethod||'delivery').toLowerCase();
  if(method==='pickup'){
    if(settings.pickupEnabled!==true)throw new Error('Local pickup is not available for this store');
  }else if(zones.length){
    const country=String(input.countryCode||'').toUpperCase();
    const zone=zones.find(item=>item.countryCodes.includes(country));
    if(!zone)throw new Error('This store does not deliver to the selected country');
    shipping=Number(zone.freeShippingThreshold!=null&&subtotal>=Number(zone.freeShippingThreshold)?0:zone.fee);
  }else{
    shipping=subtotal>=300?0:25;
  }

  let discount=0,discountCode='';
  const code=String(input.discountCode||'').trim().toUpperCase();
  if(code){
    const promotion=(settings.discounts||[]).find(item=>item.code.toUpperCase()===code&&item.enabled!==false);
    if(!promotion)throw new Error('Discount code is invalid or unavailable');
    const now=Date.now();
    if(promotion.startsAt&&Date.parse(promotion.startsAt)>now)throw new Error('Discount code is not active yet');
    if(promotion.endsAt&&Date.parse(promotion.endsAt)<now)throw new Error('Discount code has expired');
    if(promotion.usageLimit!=null&&Number(input.discountUses||0)>=promotion.usageLimit)throw new Error('Discount code usage limit has been reached');
    discount=promotion.type==='percent'?subtotal*promotion.value/100:promotion.value;
    discount=Math.round(Math.min(subtotal,discount)*100)/100;
    discountCode=promotion.code;
  }
  const taxBase=Math.max(0,subtotal-discount)+(settings.taxShipping===true?shipping:0);
  const tax=settings.taxEnabled===true?Math.round(taxBase*(Number(settings.taxRatePercent||0)/100)*100)/100:0;
  const total=Math.max(0,subtotal-discount+shipping+tax);
  return {currency,subtotal,shipping,discount,tax,taxLabel:settings.taxLabel||'Tax',total,discountCode};
}
