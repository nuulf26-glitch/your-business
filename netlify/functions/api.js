const { getConnectionString } = require('@netlify/database');

exports.handler = async (...args) => {
  if (!process.env.DATABASE_URL && !process.env.NETLIFY_DB_URL) {
    try {
      process.env.NETLIFY_DB_URL = getConnectionString();
    } catch {
      console.error('CYB API database connection is not configured for this deploy.');
      return {
        statusCode: 503,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({ message: 'CYB API is missing its database connection for this deploy. Configure an isolated staging database and try again.' }),
      };
    }
  }
  process.env.DATABASE_URL ||= process.env.NETLIFY_DB_URL;
  return require('../../backend/dist/netlify.js').handler(...args);
};
