import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITOR_MODES, editorMode } from '../src/editor/editorState.js';

test('simple, advanced, and professional are selectable modes for the same editor model', () => {
  const design = Object.freeze({ brandName: 'Studio', sections: Object.freeze([{ id: 'hero', title: 'Welcome' }]) });
  const originalDesign = structuredClone(design);
  assert.deepEqual(EDITOR_MODES.map(mode => mode.id), ['simple', 'advanced', 'professional']);
  for (const mode of EDITOR_MODES) assert.equal(editorMode(mode.id), mode.id);
  assert.equal(editorMode('unknown-mode'), 'simple');
  assert.deepEqual(design, originalDesign);
});
