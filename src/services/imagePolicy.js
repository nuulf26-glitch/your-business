const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
export const IMAGE_ACCEPT = Object.keys(EXTENSIONS).join(',');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function validateImage(file) {
  if (!file || !EXTENSIONS[file.type]) throw new Error('Choose a JPG, PNG, WebP, GIF or AVIF image. Export HEIC photos as JPG first.');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error('Choose a non-empty image up to 8 MB.');
  return EXTENSIONS[file.type];
}
export function imageError(error) {
  return {
    'storage/unauthorized': 'Image upload is not permitted. Your administrator needs to check Storage access for this account.',
    'storage/bucket-not-found': 'Image storage is not configured. Please contact support.',
    'storage/quota-exceeded': 'Image storage is temporarily full. Please try again later.',
    'storage/retry-limit-exceeded': 'The upload timed out. Check your connection and try again.',
    'storage/canceled': 'The upload was cancelled or timed out. Your existing image is unchanged.',
  }[error?.code] || error?.message || 'Could not upload this image. Please try again.';
}
