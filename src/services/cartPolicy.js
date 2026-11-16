export function readCart(storage) {
 try { const value=JSON.parse(storage.getItem('businessCart')||'[]');return Array.isArray(value)?value.filter(item=>item&&typeof item.productId==='string'&&Number(item.quantity)>0):[]; }catch{return [];}
}
export function appendCart(cart,product,quantity=1){
 if(!product.storeUrl)throw Error('This product is not linked to a store.');
 if(cart.some(item=>item.storeUrl&&item.storeUrl!==product.storeUrl))throw Error('Your cart contains items from another store. Clear it before shopping with this business.');
 const hasTrackedStock=product.stock!==undefined&&product.stock!==null&&String(product.stock).trim()!=='';
 const stock=hasTrackedStock?Math.max(0,Number(product.stock)||0):99;
 if(hasTrackedStock&&!stock)throw Error('This product is out of stock.');
 const variantId=String(product.variantId||'');
 const current=cart.find(item=>item.productId===product.id&&String(item.variantId||'')===variantId);
 const requested=(Number(current?.quantity)||0)+Math.max(1,Math.floor(Number(quantity)||1));
 const amount=hasTrackedStock?Math.min(stock,requested):requested;
 const item={productId:product.id,name:product.name,price:product.price,imageUrl:product.imageUrl||'',category:product.category||'',quantity:amount,storeUrl:product.storeUrl,...(variantId?{variantId,variantName:product.variantName||'',sku:product.sku||''}:{})};
 return current?cart.map(row=>row.productId===product.id&&String(row.variantId||'')===variantId?item:row):[...cart,item];
}
