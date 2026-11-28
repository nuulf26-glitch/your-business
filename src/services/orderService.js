import { customBackendRequest } from './customBackendSession';

const displayStatus = (value) => String(value || '').replace(/^./, (letter) => letter.toUpperCase());
const fromOrder = (row) => {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const legacyOrderNumber = data.id && String(data.id) !== String(row.id) ? String(data.id) : '';
  return {
    ...data,
    // The database ID must win: payment and fulfillment APIs are keyed by it.
    id: row.id,
    orderNumber: data.orderNumber || legacyOrderNumber || row.id,
    status: displayStatus(row.status || data.fulfillmentStatus || data.status),
    createdAt: row.createdAt || data.createdAt,
  };
};

export async function addOrder(order) { return fromOrder(await customBackendRequest('/orders', { method: 'POST', body: JSON.stringify({ data: order }) })); }
export async function getOrders() { return (await customBackendRequest('/orders')).map(fromOrder); }
export async function updateOrderStatus(id, status) { return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: String(status).toLowerCase() }) })); }
export async function deleteOrder(id) { return customBackendRequest(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function getOrder(id) { return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}`)); }
export async function updatePaymentStatus(id, status) { return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}/payment`, { method: 'PATCH', body: JSON.stringify({ data: { status: String(status).toLowerCase() } }) })); }
export async function updateFulfillment(id, data) { return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}/fulfillment`, { method: 'PATCH', body: JSON.stringify({ data }) })); }
