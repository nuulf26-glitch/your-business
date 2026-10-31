import test from 'node:test';
import assert from 'node:assert/strict';
import { websitePublicationStatus } from '../src/editor/websiteStatus.js';

const published = {
  editorVersion: 2,
  brandName: 'Studio',
  sections: [{ id: 'hero', type: 'hero', title: 'Hello', href: '/shop' }],
};

test('website status follows the backend published snapshot, not local browser flags', () => {
  assert.equal(websitePublicationStatus(null), 'Draft');
  assert.equal(websitePublicationStatus({ draft: published, published: null }), 'Draft');
  assert.equal(websitePublicationStatus({ draft: published, published, publishedAt: '2026-10-31T00:00:00Z' }), 'Published');
});

test('a saved edit after publishing is reported without changing the published snapshot', () => {
  const draft = { ...published, sections: [{ ...published.sections[0], title: 'New draft title' }] };
  assert.equal(websitePublicationStatus({ draft, published, publishedAt: '2026-10-31T00:00:00Z' }), 'Unpublished changes');
  assert.equal(published.sections[0].title, 'Hello');
});
