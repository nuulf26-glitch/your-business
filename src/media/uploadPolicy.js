export const MAX_MEDIA_UPLOAD_BYTES = 4 * 1024 * 1024;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const SUPPORTED_MEDIA_TYPES = [...SUPPORTED_IMAGE_TYPES, 'video/mp4', 'video/webm', 'video/quicktime'];

export function isSupportedImageFile(file) {
  return SUPPORTED_IMAGE_TYPES.includes(file?.type) && file.size > 0 && file.size <= MAX_MEDIA_UPLOAD_BYTES;
}
