import { hasStagingTestPublishingEntitlement } from '../src/staging-test-entitlement';

const now = new Date('2026-11-19T12:00:00.000Z');
const user = { id: 'synthetic-user-1', email: 'releaseqa@example.test' };
const stagingEnv = {
  PUBLIC_APP_URL: 'https://getcyb-staging-web.onrender.com',
  CYB_STAGING_TEST_PUBLISHING_ENABLED: 'true',
  CYB_STAGING_TEST_PUBLISH_EMAIL: 'releaseqa@example.test',
  CYB_STAGING_TEST_PUBLISH_EXPIRES_AT: '2026-11-19T12:30:00.000Z',
};

describe('temporary staging publishing entitlement', () => {
  it('allows only the allowlisted staging account before the explicit expiry', () => {
    expect(hasStagingTestPublishingEntitlement(user, stagingEnv, now)).toBe(true);
    expect(hasStagingTestPublishingEntitlement(
      { ...user, email: 'RELEASEQA@example.test' }, stagingEnv, now,
    )).toBe(true);
  });

  it('fails closed when the feature is disabled or required settings are absent', () => {
    expect(hasStagingTestPublishingEntitlement(user, {
      ...stagingEnv, CYB_STAGING_TEST_PUBLISHING_ENABLED: 'false',
    }, now)).toBe(false);
    expect(hasStagingTestPublishingEntitlement(user, {
      PUBLIC_APP_URL: stagingEnv.PUBLIC_APP_URL,
    }, now)).toBe(false);
  });

  it('rejects other accounts and production origins even if the allowlist is copied', () => {
    expect(hasStagingTestPublishingEntitlement(
      { ...user, email: 'another@example.test' }, stagingEnv, now,
    )).toBe(false);
    expect(hasStagingTestPublishingEntitlement(user, {
      ...stagingEnv, PUBLIC_APP_URL: 'https://getcyb.fit',
    }, now)).toBe(false);
    expect(hasStagingTestPublishingEntitlement(user, {
      ...stagingEnv, PUBLIC_APP_URL: 'https://cyb-production-web-uzsq.onrender.com',
    }, now)).toBe(false);
  });

  it('rejects missing identity, malformed expiry, and expired grants', () => {
    expect(hasStagingTestPublishingEntitlement(
      { email: user.email }, stagingEnv, now,
    )).toBe(false);
    expect(hasStagingTestPublishingEntitlement(user, {
      ...stagingEnv, CYB_STAGING_TEST_PUBLISH_EXPIRES_AT: 'not-a-date',
    }, now)).toBe(false);
    expect(hasStagingTestPublishingEntitlement(user, {
      ...stagingEnv, CYB_STAGING_TEST_PUBLISH_EXPIRES_AT: '2026-11-19T12:00:00.000Z',
    }, now)).toBe(false);
  });
});
