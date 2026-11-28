import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { businessCall } from '../src/business/api.js';

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
let requests = [];
let responseForRequest = () => ({ ok: true, status: 200, body: {} });

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: { getItem: () => null, removeItem: () => {} },
});
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : undefined });
  const response = responseForRequest(requests.at(-1));
  return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': 'application/json' } });
};

after(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
  else delete globalThis.sessionStorage;
});

test('draft API loads the persisted model and full record from the owner route', async () => {
  requests = [];
  const draft = { brandName: 'Studio', sections: [{ id: 'hero', title: 'Saved heading' }] };
  responseForRequest = () => ({ ok: true, status: 200, body: { draft, published: null, publishedAt: null, revision: 3 } });

  assert.deepEqual(await businessCall('loadWebsiteDraft'), draft);
  assert.deepEqual(await businessCall('loadWebsiteRecord'), { draft, published: null, publishedAt: null, revision: 3 });
  assert.deepEqual(requests.map(({ url, method }) => [new URL(url, 'http://test').pathname, method]), [
    ['/api/v1/websites/draft', 'GET'],
    ['/api/v1/websites/draft', 'GET'],
  ]);
});

test('save and publish use separate endpoints; publishing does not pre-save over another draft', async () => {
  requests = [];
  const model = { brandName: 'Studio', sections: [{ id: 'hero', title: 'Intended publish' }] };
  responseForRequest = () => ({ ok: true, status: 200, body: { slug: 'studio-123456' } });

  await businessCall('saveWebsiteDraft', { model });
  await businessCall('publishWebsiteSnapshot', { model });
  assert.deepEqual(requests.map(({ url, method }) => [new URL(url, 'http://test').pathname, method]), [
    ['/api/v1/websites/draft', 'PUT'],
    ['/api/v1/websites/publish', 'POST'],
  ]);
  assert.deepEqual(requests.map(request => request.body?.model), [model, model]);
});

test('expired authenticated API requests surface an actionable session message', async () => {
  requests = [];
  responseForRequest = () => ({ ok: false, status: 401, body: { message: 'Unauthorized' } });
  await assert.rejects(businessCall('loadWebsiteDraft'), error => {
    assert.equal(error.status, 401);
    assert.match(error.message, /session expired/i);
    return true;
  });
});
