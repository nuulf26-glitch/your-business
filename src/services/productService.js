import { customBackendRequest } from './customBackendSession';
import { businessCall } from '../business/api';

import { fromProduct } from './productRecord';

export async function addProduct(product) {
  const data = { ...product }; delete data.id;
  const row = await customBackendRequest('/products', { method: 'POST', body: JSON.stringify({ data }) });
  return row.id;
}
export async function getProducts() { return (await customBackendRequest('/products')).map(fromProduct); }
export async function getProductsByStore(storeUrl) { return businessCall('loadPublicProducts', { storeUrl }); }
export async function getProductById(id) { return businessCall('loadPublicProduct', { id }); }
export async function deleteProduct(id) { return customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function updateProduct(id, updatedProduct) { return fromProduct(await customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ data: updatedProduct }) })); }
