import { customBackendRequest } from './customBackendSession';
import { businessCall } from '../business/api';

const fromProduct = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}), name: row.name || row.data?.name });

export async function addProduct(product) {
  const row = await customBackendRequest('/products', { method: 'POST', body: JSON.stringify({ data: product }) });
  return row.id;
}
export async function getProducts() { return (await customBackendRequest('/products')).map(fromProduct); }
export async function getProductsByStore(storeUrl) { return businessCall('loadPublicProducts', { storeUrl }); }
export async function getProductById(id) { return businessCall('loadPublicProduct', { id }); }
export async function deleteProduct(id) { return customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function updateProduct(id, updatedProduct) { return fromProduct(await customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ data: updatedProduct }) })); }
