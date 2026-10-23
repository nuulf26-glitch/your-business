function pickupOrder(catalog,request,now=Date.now()) {
  if (!catalog.takeawayEnabled) throw new Error('Takeaway ordering is not enabled.');
  if (!Array.isArray(request.items) || !request.items.length || request.items.length>50) throw new Error('Choose between 1 and 50 menu items.');
  const ids=new Set();
  const items=request.items.map(row=>{
    if(ids.has(row.id)) throw new Error('Duplicate menu item.'); ids.add(row.id);
    const item=catalog.menu?.find(item=>item.id===row.id&&item.active!==false);
    const quantity=Number(row.quantity);
    if(!item || !Number.isInteger(quantity)||quantity<1||quantity>50) throw new Error('A menu item or quantity is unavailable.');
    const unitPrice=Math.round(Number(item.price)*100);
    if(!Number.isSafeInteger(unitPrice)||unitPrice<0) throw new Error('Invalid menu price.');
    return { id:item.id,name:item.name,quantity,unitPrice };
  });
  const pickupAt=Date.parse(request.pickupAt);
  if(!Number.isFinite(pickupAt)||pickupAt<now+15*60000||pickupAt>now+7*86400000) throw new Error('Choose a pickup time between 15 minutes and 7 days from now.');
  return {items,total:items.reduce((sum,row)=>sum+row.unitPrice*row.quantity,0),currency:'USD',pickupAt,paymentStatus:'unpaid',status:'new'};
}
const transitions={new:['accepted','cancelled'],accepted:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['completed','cancelled'],completed:[],cancelled:[]};
function orderTransition(current,next){if(!transitions[current]?.includes(next))throw new Error('This order status change is not available.');return next;}
module.exports={pickupOrder,orderTransition};
