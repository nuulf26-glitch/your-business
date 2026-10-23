import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftPatch, draftWebsite, publishedWebsite, publishPatch, validateWebsite } from '../src/editor/publishing.js';
const model = title => ({ brandName: title, sections: [{ id: 'hero', type: 'hero', title }] });
test('saving a draft freezes legacy live content and leaves it unchanged on later saves', () => {
  const live = model('Live');
  const store = { editorData: live, storeUrl: 'salon', published: true };
  const saved = { ...store, ...draftPatch(store, model('Draft')) };
  assert.deepEqual(publishedWebsite(saved), live);
  assert.equal(draftWebsite(saved).brandName, 'Draft');
  const second = { ...saved, ...draftPatch(saved, model('Later')) };
  assert.deepEqual(publishedWebsite(second), live);
  assert.equal(second.storeUrl, 'salon');
});
test('publish creates a detached validated snapshot', () => {
  const input = model('New');
  const patch = publishPatch(input, 'time');
  input.sections[0].title = 'Changed';
  assert.equal(publishedWebsite(patch).sections[0].title, 'New');
  assert.equal(patch.publishedAt, 'time');
});
test('explicit unpublish wins; legacy data stays compatible', () => {
  assert.equal(publishedWebsite({ published: false, editorData: model('Old') }), null);
  assert.equal(publishedWebsite({ editorData: model('Old') }).brandName, 'Old');
  assert.equal(publishedWebsite({ draftEditorData: model('Private') }), null);
});
test('rejects empty and duplicate sections', () => {
  assert.throws(() => validateWebsite({ brandName: 'Name', sections: [] }));
  assert.throws(() => validateWebsite({ brandName: 'Name', sections: [{ id: 'x' }, { id: 'x' }] }));
});
