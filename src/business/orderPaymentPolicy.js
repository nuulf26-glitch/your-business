const terminalOrderStatuses = new Set(["cancelled", "returned"]);

export function canMarkOrderCollected(order) {
  const fulfillmentStatus = String(order?.fulfillmentStatus || order?.status || "").trim().toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").trim().toLowerCase();
  return !terminalOrderStatuses.has(fulfillmentStatus) && paymentStatus !== "cancelled";
}

