import { tokenHash } from '../src/session';

describe('opaque session token storage', () => {
  it('stores a deterministic digest instead of the bearer token', () => {
    const token = 'sample-random-session-token';
    const digest = tokenHash(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(tokenHash(token)).toBe(digest);
  });

  it('produces different digests for different tokens', () => {
    expect(tokenHash('token-a')).not.toBe(tokenHash('token-b'));
  });
});
