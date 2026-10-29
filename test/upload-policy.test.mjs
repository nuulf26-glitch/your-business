import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MEDIA_UPLOAD_BYTES, SUPPORTED_MEDIA_TYPES, isSupportedImageFile } from '../src/media/uploadPolicy.js';

test('media upload rules match the safe Netlify request payload size', () => {
  assert.equal(MAX_MEDIA_UPLOAD_BYTES, 4 * 1024 * 1024);
  assert.equal(SUPPORTED_MEDIA_TYPES.includes('video/mp4'), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: MAX_MEDIA_UPLOAD_BYTES }), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: MAX_MEDIA_UPLOAD_BYTES + 1 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml', size: 100 }), false);
});
