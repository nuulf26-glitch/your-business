export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;
export const MAX_MEDIA_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_BYTES;
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const SUPPORTED_MEDIA_TYPES = [...SUPPORTED_IMAGE_TYPES, 'video/mp4', 'video/webm'];
export function isSupportedImageFile(file) {
  return SUPPORTED_IMAGE_TYPES.includes(file?.type) && file.size > 0 && file.size <= MAX_IMAGE_UPLOAD_BYTES;
}
export function validateMediaFile(file) {
  if (!SUPPORTED_MEDIA_TYPES.includes(file?.type)) throw new Error('Choose JPEG, PNG, WebP, GIF, MP4 (H.264/AAC), or WebM (VP8/VP9/Opus). Convert MOV/HEVC to MP4 H.264 first.');
  const video = file.type.startsWith('video/');
  if (file.size < 1 || file.size > (video ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES)) throw new Error(video ? 'Videos must be 250 MB or smaller.' : 'Images must be 20 MB or smaller.');
}
