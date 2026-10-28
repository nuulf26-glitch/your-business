export function mediaItems(value = {}) {
  if (Array.isArray(value.media)) return value.media;
  const images = value.images?.filter(Boolean) || [];
  const urls = images.length ? images : [value.imageUrl || value.image].filter(Boolean);
  return urls.map((url, index) => ({ id: `legacy-${index}`, type: 'image', url, alt: value.alt || value.name || '', width: 100, unit: '%', height: '', fit: 'cover' }));
}
export function safeMediaUrl(url) {
  return typeof url === 'string' && (/^https:\/\//i.test(url) || /^\/api\/v1\/uploads\/[a-zA-Z0-9_/-]+$/.test(url));
}
export function primaryImage(media) { return media.find(item => item.type === 'image')?.url || ''; }
export function mediaStyle(item) {
  const width = Number(item.width);
  const height = Number(item.height);
  return { width: `${Number.isFinite(width) && width > 0 ? Math.min(width,item.unit === 'px' ? 4000 : 100) : 100}${item.unit === 'px' ? 'px' : '%'}`, maxWidth: '100%', height: height > 0 ? `${Math.min(height,4000)}px` : 'auto', objectFit: item.fit === 'contain' ? 'contain' : 'cover' };
}
