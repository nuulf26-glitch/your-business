import { customBackendRequest } from './customBackendSession';

const body = (data) => JSON.stringify({ data });
export const listCmsCollections = () => customBackendRequest('/cms/collections');
export const createCmsCollection = (data) => customBackendRequest('/cms/collections', { method: 'POST', body: body(data) });
export const updateCmsCollection = (id, data) => customBackendRequest(`/cms/collections/${encodeURIComponent(id)}`, { method: 'PATCH', body: body(data) });
export const archiveCmsCollection = (id) => customBackendRequest(`/cms/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listCmsEntries = (id, status = '') => customBackendRequest(`/cms/collections/${encodeURIComponent(id)}/entries${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const createCmsEntry = (collectionId, data) => customBackendRequest(`/cms/collections/${encodeURIComponent(collectionId)}/entries`, { method: 'POST', body: body(data) });
export const updateCmsEntry = (id, data) => customBackendRequest(`/cms/entries/${encodeURIComponent(id)}`, { method: 'PATCH', body: body(data) });
export const publishCmsEntry = (id) => customBackendRequest(`/cms/entries/${encodeURIComponent(id)}/publish`, { method: 'POST', body: body({}) });
export const unpublishCmsEntry = (id) => customBackendRequest(`/cms/entries/${encodeURIComponent(id)}/unpublish`, { method: 'POST', body: body({}) });
export const archiveCmsEntry = (id) => customBackendRequest(`/cms/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getPublicCmsCollection = (businessSlug, collectionSlug, entrySlug = '') => {
  const query = entrySlug ? `?entry=${encodeURIComponent(entrySlug)}` : '';
  return customBackendRequest(`/public/cms/${encodeURIComponent(businessSlug)}/${encodeURIComponent(collectionSlug)}${query}`);
};
