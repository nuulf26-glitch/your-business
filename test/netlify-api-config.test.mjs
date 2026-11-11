import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handler } = require('../netlify/functions/api.js');

test('Netlify API returns a safe, actionable response when preview database config is missing', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousNetlifyDatabaseUrl = process.env.NETLIFY_DB_URL;
  const previousConsoleError = console.error;
  delete process.env.DATABASE_URL;
  delete process.env.NETLIFY_DB_URL;
  console.error = () => {};
  try {
    const result = await handler({ httpMethod: 'GET', path: '/api/v1/health' });
    assert.equal(result.statusCode, 503);
    assert.match(result.headers['content-type'], /application\/json/);
    assert.match(JSON.parse(result.body).message, /isolated staging database/);
  } finally {
    console.error = previousConsoleError;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousNetlifyDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
    else process.env.NETLIFY_DB_URL = previousNetlifyDatabaseUrl;
  }
});
