import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MEDIA_UPLOAD_BYTES, SUPPORTED_MEDIA_TYPES, isSupportedImageFile } from '../src/media/uploadPolicy.js';

test('direct image uploads allow 20 MB without a serverless payload', () => {
  assert.equal(MAX_MEDIA_UPLOAD_BYTES, 20 * 1024 * 1024);
  assert.equal(SUPPORTED_MEDIA_TYPES.includes('video/mp4'), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: MAX_MEDIA_UPLOAD_BYTES }), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: MAX_MEDIA_UPLOAD_BYTES + 1 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml', size: 100 }), false);
});

import {validateMediaFile,MAX_VIDEO_UPLOAD_BYTES} from '../src/media/uploadPolicy.js';
test('practical video boundaries and explicit unsupported containers',()=>{
 assert.doesNotThrow(()=>validateMediaFile({type:'video/mp4',size:MAX_VIDEO_UPLOAD_BYTES}));
 assert.throws(()=>validateMediaFile({type:'video/mp4',size:MAX_VIDEO_UPLOAD_BYTES+1}),/250 MB/);
 assert.throws(()=>validateMediaFile({type:'video/quicktime',size:100}),/Convert MOV/);
 assert.throws(()=>validateMediaFile({type:'image/png',size:0}),/20 MB/);
});
