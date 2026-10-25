const DAY = 86400000;
const TRIAL_DAYS = 14;
function accessPolicy({ createdAt, rolloutAt, entitlement, now = Date.now(), enforceExpiry = false }) {
  const start = Date.parse(createdAt), rollout = Date.parse(rolloutAt);
  const paidUntil = Date.parse(entitlement?.validUntil || '');
  if (entitlement?.status === 'active' && (entitlement.lifetime === true || paidUntil > now)) return { status: 'active', canPublish: true, daysRemaining: null };
  // Rollout is deliberately configuration-gated to preserve existing access.
  // Auth creation time, never a browser profile date, anchors the trial.
  if (!Number.isFinite(start) || !Number.isFinite(rollout)) return { status: 'setup_pending', canPublish: true, daysRemaining: null };
  if (start < rollout) return { status: 'existing_account', canPublish: true, daysRemaining: null };
  const ends = start + TRIAL_DAYS * DAY;
  return { status: ends > now ? 'trial' : 'expired', trialStartedAt: new Date(start).toISOString(), trialEndsAt: new Date(ends).toISOString(), daysRemaining: Math.max(0, Math.ceil((ends - now) / DAY)), canPublish: ends > now || !enforceExpiry, restrictionsEnabled: enforceExpiry };
}
module.exports = { accessPolicy, TRIAL_DAYS };
