import { useState } from 'react';
import { mediaItems, mediaStyle, safeMediaUrl } from './media';
import './media.css';
export default function MediaDisplay({ value, title = '', className = '' }) {
  const items = mediaItems(value).filter(item => safeMediaUrl(item.url) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(item.url));
  if (!items.length) {
    const count = Math.max(0, Math.min(8, Number(value?.imagePlaceholderCount) || 0));
    if (!count) return null;
    return <div className={`cyb-media-display cyb-media-placeholders ${className}`} aria-label="Editable image placeholders">{Array.from({ length: count }, (_, index) => <div className="cyb-media-placeholder" key={index} role="img" aria-label={`Image placeholder ${index + 1}`}><span aria-hidden="true">＋</span><small>{title || 'Add an image'}</small></div>)}</div>;
  }
  return <div className={`cyb-media-display ${className}`}>{items.map((item,index) => <figure key={item.id || index} style={mediaStyle(item)}><MediaContent key={item.url} item={item} title={title}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>;
}

function MediaContent({item,title}) {
  const [failed,setFailed]=useState(false);
  const style={width:'100%',height:'100%',objectFit:item.fit==='contain'?'contain':'cover'};
  return <>{item.type==='video'?<video src={item.url} controls playsInline preload="metadata" aria-label={item.alt||title||'Video'} style={style} onClick={event=>event.stopPropagation()} onError={()=>setFailed(true)}/>:<img src={item.url} alt={item.alt||title} loading="lazy" style={style} onError={()=>setFailed(true)}/>}{failed&&<p role="alert" className="cyb-media-error">{item.type==='video'?'This video could not play. Check your connection or use MP4 with H.264 video and AAC audio.':'This image could not load. Check your connection or replace it with a valid uploaded image.'}</p>}</>;
}
