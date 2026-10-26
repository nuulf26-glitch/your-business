import { customBackendRequest } from './customBackendSession';

const displayStatus = (value) => String(value || '').replace(/^./, (letter) => letter.toUpperCase());
const fromOrder = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}), status: displayStatus(row.status || row.data?.status), createdAt: row.createdAt || row.data?.createdAt });

export async function addOrder(order) { return fromOrder(await customBackendRequest('/orders', { method: 'POST', body: JSON.stringify({ data: order }) })); }
export async function getOrders() { return (await customBackendRequest('/orders')).map(fromOrder); }
export async function updateOrderStatus(id, status) { return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: String(status).toLowerCase() }) })); }
export async function deleteOrder(id) { return customBackendRequest(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
