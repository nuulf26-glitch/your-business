const STAGING_PUBLISH_ORIGIN = 'https://getcyb-staging-web.onrender.com';

type TestEntitlementUser = { id?: string; email?: string | null };
type EntitlementEnvironment = Record<string, string | undefined>;

export function hasStagingTestPublishingEntitlement(
  user: TestEntitlementUser,
  env: EntitlementEnvironment = process.env,
  now: Date = new Date(),
): boolean {
  if (!user?.id || !user.email) return false;

  let appOrigin = '';
  try {
    appOrigin = new URL(env.PUBLIC_APP_URL || '').origin;
  } catch {
    return false;
  }
  if (appOrigin !== STAGING_PUBLISH_ORIGIN) return false;
  if (env.CYB_STAGING_TEST_PUBLISHING_ENABLED !== 'true') return false;

  const allowedEmail = env.CYB_STAGING_TEST_PUBLISH_EMAIL?.trim().toLowerCase();
  const expiresAt = Date.parse(env.CYB_STAGING_TEST_PUBLISH_EXPIRES_AT || '');
  if (!allowedEmail || !Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return false;

  return user.email.trim().toLowerCase() === allowedEmail;
}
