import { customBackendRequest } from './customBackendSession';

const request = (path, method = 'GET', data) => customBackendRequest(path, {
  method,
  ...(data !== undefined ? { body: JSON.stringify({ data }) } : {}),
});

export const getMembershipTiers = () => request('/memberships/tiers');
export const createMembershipTier = (data) => request('/memberships/tiers', 'POST', data);
export const updateMembershipTier = (id, data) => request(`/memberships/tiers/${encodeURIComponent(id)}`, 'PATCH', data);
export const getMembershipEntitlements = () => request('/memberships/entitlements');
export const grantMembershipEntitlement = (data) => request('/memberships/entitlements', 'POST', data);
export const revokeMembershipEntitlement = (id) => request(`/memberships/entitlements/${encodeURIComponent(id)}/revoke`, 'PATCH', {});
export const loadMemberContent = (token) => customBackendRequest('/public/memberships/access', {
  method: 'POST',
  body: JSON.stringify({ token }),
});
