function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function orderData(order) {
  return order?.data && typeof order.data === "object" ? { ...order.data, ...order } : (order || {});
}

function collectedCents(order) {
  const data = orderData(order);
  const events = Array.isArray(data.paymentHistory)
    ? data.paymentHistory.filter((entry) => entry?.type === "collected")
    : [];
  if (events.length) return events.reduce((sum, entry) => sum + (Number(entry.amountCents) || 0), 0);
  if (!["paid", "refunded"].includes(String(data.paymentStatus || data.status || "").toLowerCase())) return 0;
  return Number(data.collectedAmountCents ?? data.amountCents) || cents(data.total);
}

function refundCents(order) {
  const data = orderData(order);
  return Array.isArray(data.refundHistory)
    ? data.refundHistory.reduce((sum, entry) => sum + (Number(entry?.amountCents) || 0), 0)
    : 0;
}

export function orderMetrics(orders) {
  const collected = orders.filter((order) => collectedCents(order) > 0);
  const paid = orders.filter((order) => ["paid", "refunded"].includes(String(order?.paymentStatus || order?.data?.paymentStatus || order?.status || order?.data?.status || "").toLowerCase()));
  const grossCollectedCents = collected.reduce((sum, order) => sum + collectedCents(order), 0);
  const refundedCents = orders.reduce((sum, order) => sum + refundCents(order), 0);
  const netRevenueCents = grossCollectedCents - refundedCents;
  const hasCosts = paid.every((order) => order.costOfGoods != null && order.expenses != null && Number.isFinite(Number(order.costOfGoods)) && Number.isFinite(Number(order.expenses)));
  const profit = hasCosts && paid.length
    ? paid.reduce((sum, order) => sum + (Number(order.total) || 0) - Number(order.costOfGoods) - Number(order.expenses), 0)
    : null;

  return {
    revenue: netRevenueCents / 100,
    netRevenue: netRevenueCents / 100,
    grossCollected: grossCollectedCents / 100,
    refunds: refundedCents / 100,
    paidOrders: paid.length,
    collectedOrders: collected.length,
    average: collected.length ? grossCollectedCents / 100 / collected.length : 0,
    profit,
    margin: profit != null && netRevenueCents > 0 ? profit / (netRevenueCents / 100) * 100 : null,
  };
}
