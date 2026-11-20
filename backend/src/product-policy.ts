export function productDataValidationError(value: Record<string, unknown>): string | null {
  const name=String(value.name||'').trim();
  if(!name)return 'Product name required';
  for(const field of ['sellingPrice','salePrice','costPrice','price']){
    const raw=value[field];
    if(raw===undefined||raw===null||String(raw).trim()==='')continue;
    const amount=Number(raw);
    if(!Number.isFinite(amount)||amount<0)return `${field} must be a non-negative amount`;
  }
  if(value.stock!==undefined&&value.stock!==null&&String(value.stock).trim()!==''){
    const stock=Number(value.stock);
    if(!Number.isInteger(stock)||stock<0)return 'Stock must be a non-negative whole number';
  }
  if(Array.isArray(value.variants)){
    if(value.variants.length>100)return 'A product cannot have more than 100 variants';
    for(const [index,variant] of value.variants.entries()){
      if(!variant||typeof variant!=='object'||Array.isArray(variant))return `Variant ${index+1} is invalid`;
      const row=variant as Record<string,unknown>;
      for(const field of ['price','sellingPrice','salePrice']){
        const raw=row[field];
        if(raw===undefined||raw===null||String(raw).trim()==='')continue;
        const amount=Number(raw);
        if(!Number.isFinite(amount)||amount<0)return `Variant ${index+1} ${field} must be a non-negative amount`;
      }
      if(row.stock!==undefined&&row.stock!==null&&String(row.stock).trim()!==''){
        const stock=Number(row.stock);
        if(!Number.isInteger(stock)||stock<0)return `Variant ${index+1} stock must be a non-negative whole number`;
      }
    }
  }
  if(value.sku!==undefined&&String(value.sku).length>100)return 'SKU cannot exceed 100 characters';
  return null;
}
