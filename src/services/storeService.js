import { customBackendRequest } from './customBackendSession';

function fromBusiness(business) {
  if (!business) return null;
  const settings = business.settings && typeof business.settings === 'object' ? business.settings : {};
  return { ...settings, id: business.id, userId: business.ownerId, storeUrl: business.slug, storeName: settings.storeName || business.name, businessName: settings.businessName || business.name, businessCategory: settings.businessCategory || business.category };
}

export async function saveStore(data) {
  const result = await customBackendRequest('/businesses/mine', { method: 'PUT', body: JSON.stringify({ name: data.businessName || data.storeName || 'My Business', slug: data.storeUrl, category: data.businessCategory || data.businessGoal || 'general', settings: data }) });
  return fromBusiness(result);
}
export async function getStore() { return fromBusiness(await customBackendRequest('/businesses/mine')); }
export async function getStoreByUrl(storeUrl) {
  try { return fromBusiness(await customBackendRequest(`/businesses/public/${encodeURIComponent(storeUrl)}`)); }
  catch (error) { if (error.status === 404) return null; throw error; }
}
