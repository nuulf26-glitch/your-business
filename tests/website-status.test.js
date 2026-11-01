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

test('a migrated first-page sections alias does not make an unchanged published website look modified', () => {
  const page = { id: 'home', slug: '', title: 'Home', sections: [{ id: 'hero', type: 'hero', title: 'Hello', href: '/shop' }] };
  const saved = { ...published, pages: [page] };
  const migratedDraft = { ...saved, sections: [{ ...page.sections[0], style: { color: '#171513', fontSize: 56 } }] };
  assert.equal(websitePublicationStatus({ draft: migratedDraft, published: saved, publishedAt: '2026-10-31T00:00:00Z' }), 'Published');
});

test('published status ignores JSON object key order but still detects page content changes', () => {
  const first = { ...published, pages: [{ id: 'home', sections: [{ id: 'hero', style: { color: '#000', fontSize: 56 }, title: 'Hello' }] }] };
  const sameContentDifferentKeyOrder = { ...published, pages: [{ sections: [{ title: 'Hello', style: { fontSize: 56, color: '#000' }, id: 'hero' }], id: 'home' }] };
  assert.equal(websitePublicationStatus({ draft: first, published: sameContentDifferentKeyOrder, publishedAt: '2026-10-31T00:00:00Z' }), 'Published');
  const changed = { ...sameContentDifferentKeyOrder, pages: [{ ...sameContentDifferentKeyOrder.pages[0], sections: [{ ...sameContentDifferentKeyOrder.pages[0].sections[0], title: 'Draft title' }] }] };
  assert.equal(websitePublicationStatus({ draft: changed, published: sameContentDifferentKeyOrder, publishedAt: '2026-10-31T00:00:00Z' }), 'Unpublished changes');
});
