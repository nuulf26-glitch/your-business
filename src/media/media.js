export function mediaItems(value = {}) {
  if (Array.isArray(value.media)) return value.media.map((item,index)=>({...item,id:item.id||`media-${index}`}));
  const images = value.images?.filter(Boolean) || [];
  const urls = images.length ? images : [value.imageUrl || value.image].filter(Boolean);
  return urls.map((url, index) => ({ id: `legacy-${index}`, type: 'image', url, alt: value.alt || value.name || '', width: 100, unit: '%', height: '', fit: 'cover' }));
}
export function safeMediaUrl(url) {
  return typeof url === 'string' && (/^https:\/\//i.test(url) || /^\/api\/v1\/uploads\/[a-zA-Z0-9_/-]+$/.test(url));
}
export function primaryImage(media) { return media.find(item => item.type === 'image')?.url || ''; }
export function mediaStyle(item) {
  const width = Number(item.width), height = Number(item.height);
  const w = `${Number.isFinite(width) && width > 0 ? Math.min(width,item.unit === 'px' ? 4000 : 100) : 100}${item.unit === 'px' ? 'px' : '%'}`;
  const h = height > 0 ? `${Math.min(height,4000)}px` : 'auto';
  const ratio = ['1 / 1','4 / 3','3 / 4','16 / 9','9 / 16'].includes(item.aspectRatio) ? item.aspectRatio : 'auto';
  const focal = value => Number.isFinite(Number(value)) ? Math.max(0,Math.min(100,Number(value))) : 50;
  return { width:w, maxWidth:'100%', height:h, objectFit:item.fit === 'contain' ? 'contain' : 'cover',
    '--media-width':w, '--media-height':h, '--media-ratio':ratio,
    '--media-mobile-width':`${Math.max(1,Math.min(100,Number(item.mobileWidth)||100))}%`,
    '--media-mobile-height':Number(item.mobileHeight)>0?`${Math.min(2000,Number(item.mobileHeight))}px`:'auto',
    '--media-position':`${focal(item.focalX??50)}% ${focal(item.focalY??50)}%`,
    marginLeft: ['center','right'].includes(item.align)?'auto':0, marginRight:item.align==='center'?'auto':0 };
}
