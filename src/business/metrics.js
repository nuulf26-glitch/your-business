export function orderMetrics(orders) {
  // Revenue includes only payments confirmed as collected by the merchant.
  // Fulfilled or delivered COD orders remain unpaid until explicitly marked paid.
  const completed=orders.filter(order=>String(order.paymentStatus||'').toLowerCase()==='paid');
  const revenue=completed.reduce((sum,order)=>sum+(Number(order.total)||0),0);
  const hasCosts=completed.every(order=>order.costOfGoods!=null&&order.expenses!=null&&Number.isFinite(Number(order.costOfGoods))&&Number.isFinite(Number(order.expenses)));
  const profit=hasCosts&&completed.length?completed.reduce((sum,order)=>sum+(Number(order.total)||0)-Number(order.costOfGoods)-Number(order.expenses),0):null;
  return { revenue, paidOrders:completed.length, average:completed.length?revenue/completed.length:0,profit,margin:profit!=null&&revenue>0?profit/revenue*100:null };
}
