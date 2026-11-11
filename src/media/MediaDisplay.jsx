import { mediaItems, mediaStyle, safeMediaUrl } from './media';
import './media.css';
export default function MediaDisplay({ value, title = '', className = '' }) {
  const items = mediaItems(value).filter(item => safeMediaUrl(item.url) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(item.url));
  if (!items.length) {
    const count = Math.max(0, Math.min(8, Number(value?.imagePlaceholderCount) || 0));
    if (!count) return null;
    return <div className={`cyb-media-display cyb-media-placeholders ${className}`} aria-label="Editable image placeholders">{Array.from({ length: count }, (_, index) => <div className="cyb-media-placeholder" key={index} role="img" aria-label={`Image placeholder ${index + 1}`}><span aria-hidden="true">＋</span><small>{title || 'Add an image'}</small></div>)}</div>;
  }
  return <div className={`cyb-media-display ${className}`}>{items.map((item,index) => <figure key={item.id || index} style={mediaStyle(item)}>{item.type === 'video' ? <video src={item.url} controls playsInline preload="metadata" aria-label={item.alt || title || 'Video'} style={{width:'100%',height:'100%',objectFit:item.fit || 'cover'}} onClick={event=>event.stopPropagation()} /> : <img src={item.url} alt={item.alt || title} loading="lazy" style={{width:'100%',height:'100%',objectFit:item.fit || 'cover'}} />}{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>;
}
