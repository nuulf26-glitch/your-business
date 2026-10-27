import { customBackendRequest } from './customBackendSession';

const fromCustomer = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}) });

export async function addCustomer(customer) {
  return fromCustomer(await customBackendRequest('/customers', { method: 'POST', body: JSON.stringify({ data: customer }) }));
}
// Checkout persists its customer together with the order in the backend transaction.
export async function addCustomerFromCheckout(customer) {
  if (!customer?.storeUrl || !customer?.email) return null;
  return null;
}
export async function getCustomers() { return (await customBackendRequest('/customers')).map(fromCustomer); }
export async function deleteCustomer(id) { return customBackendRequest(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function updateCustomerStatus(id, status) { return fromCustomer(await customBackendRequest(`/customers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })); }
