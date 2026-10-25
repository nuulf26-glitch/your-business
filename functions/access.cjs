const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString, defineBoolean } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { accessPolicy } = require('./accessPolicy.cjs');
const rollout = defineString('TRIAL_ROLLOUT_AT', { default: '' });
const enforceExpiry = defineBoolean('TRIAL_ENFORCE_PUBLISH', { default: false });
async function businessAccess(uid) {
  const [user, entitlement] = await Promise.all([getAuth().getUser(uid), getFirestore().doc(`businessPrivate/${uid}/billing/entitlement`).get()]);
  return accessPolicy({ createdAt: user.metadata.creationTime, rolloutAt: rollout.value(), entitlement: entitlement.data(), enforceExpiry: enforceExpiry.value() });
}
const getBusinessAccess = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const result = await businessAccess(request.auth.uid);
  if (result.trialStartedAt) await getFirestore().doc(`businessPrivate/${request.auth.uid}/billing/trial`).set({ startedAt: result.trialStartedAt, endsAt: result.trialEndsAt, checkedAt: FieldValue.serverTimestamp() }, { merge: true });
  return result;
});
async function requirePublishAccess(uid) {
  const access = await businessAccess(uid);
  if (!access.canPublish) throw new HttpsError('permission-denied', 'Your trial has ended. Your draft and existing website are safe. Activate access before publishing new changes.');
}
module.exports = { getBusinessAccess, requirePublishAccess };
