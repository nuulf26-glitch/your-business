import { customBackendRequest } from '../services/customBackendSession';

export const listMarketingContacts = () => customBackendRequest('/marketing/contacts');
export const createMarketingContact = (data) => customBackendRequest('/marketing/contacts', { method: 'POST', body: JSON.stringify({ data }) });
export const reconsentMarketingContact = (id, data) => customBackendRequest(`/marketing/contacts/${encodeURIComponent(id)}/consent`, { method: 'POST', body: JSON.stringify({ data }) });
export const unsubscribeMarketingContact = (id) => customBackendRequest(`/marketing/contacts/${encodeURIComponent(id)}/unsubscribe`, { method: 'PATCH' });
export const deleteMarketingContact = (id) => customBackendRequest(`/marketing/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const loadMarketingSettings = () => customBackendRequest('/marketing/settings');
export const saveMarketingSettings = (data) => customBackendRequest('/marketing/settings', { method: 'PATCH', body: JSON.stringify({ data }) });
export const listMarketingCampaigns = () => customBackendRequest('/marketing/campaigns');
export const createMarketingCampaign = (data) => customBackendRequest('/marketing/campaigns', { method: 'POST', body: JSON.stringify({ data }) });
export const queueMarketingCampaign = (id) => customBackendRequest(`/marketing/campaigns/${encodeURIComponent(id)}/queue`, { method: 'POST' });
export const deleteMarketingCampaign = (id) => customBackendRequest(`/marketing/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });

export function marketingUnsubscribeUrl({ businessSlug, contactId, token }, origin = window.location.origin) {
  const url = new URL('/unsubscribe', origin);
  url.searchParams.set('businessSlug', businessSlug);
  url.searchParams.set('contactId', contactId);
  url.searchParams.set('token', token);
  return url.toString();
}

export function submitPublicUnsubscribe({ businessSlug, contactId, token }) {
  return customBackendRequest('/marketing/unsubscribe', { method: 'POST', body: JSON.stringify({ data: { businessSlug, contactId, token } }) });
}
