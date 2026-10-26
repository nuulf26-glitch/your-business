const { getConnectionString } = require('@netlify/database');

exports.handler = async (...args) => {
  process.env.NETLIFY_DB_URL ||= getConnectionString();
  process.env.DATABASE_URL ||= process.env.NETLIFY_DB_URL;
  return require('../../backend/dist/netlify.js').handler(...args);
};
