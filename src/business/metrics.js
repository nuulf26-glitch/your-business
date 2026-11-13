function orderCollectedAmount(order) {
  const history = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
  if (history.length) {
    const cents = history.reduce((sum, event) => {
      const amount = Math.max(0, Number(event?.amountCents) || 0);
      if (event?.type === "collected") return sum + amount;
      if (event?.type === "refunded" || event?.type === "reversed") return sum - amount;
      return sum;
    }, 0);
    return Math.max(0, cents) / 100;
  }
  return String(order.paymentStatus || "").toLowerCase() === "paid" ? Number(order.total) || 0 : 0;
}

export function orderMetrics(orders) {
  const collected = orders.map(order => ({ order, amount: orderCollectedAmount(order) })).filter(row => row.amount > 0);
  const revenue = collected.reduce((sum, row) => sum + row.amount, 0);
  const hasCosts = collected.every(({ order }) => order.costOfGoods != null && order.expenses != null && Number.isFinite(Number(order.costOfGoods)) && Number.isFinite(Number(order.expenses)));
  const profit = hasCosts && collected.length ? collected.reduce((sum, row) => sum + row.amount - Number(row.order.costOfGoods) - Number(row.order.expenses), 0) : null;
  return { revenue, paidOrders: collected.length, average: collected.length ? revenue / collected.length : 0, profit, margin: profit != null && revenue > 0 ? profit / revenue * 100 : null };
}
