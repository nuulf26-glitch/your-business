import { useEffect, useRef, useState } from 'react';
import { uploadMedia } from '../services/imageService';
import { safeMediaUrl } from './media';
import MediaDisplay from './MediaDisplay';
import './media.css';
export default function MediaFields({ items = [], onChange, onBusyChange, disabled = false }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[url,setUrl]=useState(''),[kind,setKind]=useState('video');
  const [progress,setProgress]=useState(null),[failed,setFailed]=useState([]);
  const latest=useRef({items,onChange,onBusyChange}), lock=useRef(false), alive=useRef(true), cancel=useRef(null);
  useEffect(()=>{latest.current={items,onChange,onBusyChange};});
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancel.current?.abort();latest.current.onBusyChange?.(false);};},[]);
  const makeItem=(url,type,alt='')=>({id:crypto.randomUUID(),url,type,alt,width:100,unit:'%',height:'',fit:'cover'});
  const patch=(id,change)=>onChange(items.map(item=>item.id===id?{...item,...change}:item));
  function move(index,delta){const next=[...items];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next);}
  async function upload(files,replaceId=null){
    if(!files.length||lock.current||disabled)return;
    lock.current=true;setBusy(true);latest.current.onBusyChange?.(true);setError('');setSuccess('');setFailed([]);cancel.current=new AbortController();
    const errors=[],failures=[];let count=0;
    for(const file of files){
      if(!alive.current)break;
      try{
        const uploaded=await uploadMedia(file,{signal:cancel.current.signal,onProgress:state=>{if(alive.current)setProgress({...state,name:file.name});}});
        if(!alive.current)break;
        const current=latest.current;
        const next=replaceId?current.items.map(item=>item.id===replaceId?{...item,url:uploaded,type:file.type.startsWith('video/')?'video':'image',alt:file.name}:item):[...current.items,makeItem(uploaded,file.type.startsWith('video/')?'video':'image',file.name)];
        // Update the ref before waiting for React, so sequential files cannot overwrite one another.
        latest.current={...current,items:next};
        await current.onChange(next);count++;
      }catch(e){errors.push(`${file.name}: ${e.message}`);failures.push({file,replaceId});}
    }
    if(alive.current){setError(errors.join('\n'));setFailed(failures);setSuccess(count?`${count} ${count===1?'file':'files'} added. Save your changes to keep them.`:'');setProgress(null);setBusy(false);}
    lock.current=false;latest.current.onBusyChange?.(false);
  }
  const choose=(event,replaceId=null)=>{const files=[...event.target.files];event.target.value='';void upload(files,replaceId);};
  return <fieldset className="cyb-media-fields" disabled={disabled}><legend>Images & videos</legend>
    <div className="cyb-media-add"><label className="cyb-media-file-button">Add Image<input aria-label="Add Image" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={choose}/></label><label className="cyb-media-file-button">Add Video<input aria-label="Add Video" type="file" multiple accept="video/mp4,video/webm" disabled={busy} onChange={choose}/></label></div>
    <small>Images up to 20 MB. Videos up to 250 MB: MP4 H.264/AAC or WebM VP8/VP9/Opus. The first image is the main product image.</small>
    {progress&&<div role="status"><span>{progress.name}: {progress.phase==='preparing'?'Preparing…':progress.phase==='verifying'?'Checking file and codecs…':`Uploading ${progress.percent}%`}</span><progress max="100" value={progress.phase==='preparing'?undefined:progress.percent}/></div>}
    {success&&<p role="status">{success}</p>}{error&&<p role="alert" style={{whiteSpace:'pre-line'}}>{error}</p>}
    {!!failed.length&&<button type="button" disabled={busy} onClick={()=>upload(failed.map(item=>item.file),failed[0].replaceId)}>Retry failed uploads</button>}
    <div className="cyb-media-url"><label>Media type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="video">Video</option><option value="image">Image</option></select></label><label>Direct media URL<input type="url" value={url} placeholder="https://…/video.mp4" onChange={e=>setUrl(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>{if(!safeMediaUrl(url.trim())){setError('Use a direct HTTPS image or video URL.');return;}onChange([...items,makeItem(url.trim(),kind)]);setUrl('');setError('');}}>Add URL</button></div>
    {items.map((item,index)=><div className="cyb-media-item" key={item.id||index}>
      <MediaDisplay value={{media:[{...item,width:100,unit:'%',height:120,mobileHeight:120}]}}/>
      <strong>{item.type==='image'&&items.find(entry=>entry.type==='image')===item?'Main image':`${item.type==='video'?'Video':'Image'} ${index+1}`}</strong>
      <label>Description<input value={item.alt||''} onChange={e=>patch(item.id,{alt:e.target.value})}/></label>
      <div className="cyb-media-size"><label>Width<input type="number" min="1" max={item.unit==='px'?4000:100} value={item.width||100} onChange={e=>patch(item.id,{width:Math.max(1,Math.min(item.unit==='px'?4000:100,Number(e.target.value)))})}/></label><label>Unit<select value={item.unit||'%'} onChange={e=>patch(item.id,{unit:e.target.value,width:e.target.value==='%'?Math.min(100,item.width||100):item.width||100})}><option>%</option><option>px</option></select></label><label>Height (px)<input type="number" min="0" max="4000" placeholder="Auto" value={item.height||''} onChange={e=>patch(item.id,{height:e.target.value?Math.max(0,Math.min(4000,Number(e.target.value))):''})}/></label></div>
      <label>Aspect ratio<select value={item.aspectRatio||'auto'} onChange={e=>patch(item.id,{aspectRatio:e.target.value,height:''})}>{['auto','1 / 1','4 / 3','3 / 4','16 / 9','9 / 16'].map(ratio=><option key={ratio} value={ratio}>{ratio==='auto'?'Original':ratio}</option>)}</select></label>
      <label>Image/video fit<select value={item.fit||'cover'} onChange={e=>patch(item.id,{fit:e.target.value})}><option value="cover">Fill & crop</option><option value="contain">Show entire image/video</option></select></label>
      <label>Alignment<select value={item.align||'left'} onChange={e=>patch(item.id,{align:e.target.value})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <label>Focal point — horizontal<input type="range" min="0" max="100" value={item.focalX??50} onChange={e=>patch(item.id,{focalX:Number(e.target.value)})}/></label><label>Focal point — vertical<input type="range" min="0" max="100" value={item.focalY??50} onChange={e=>patch(item.id,{focalY:Number(e.target.value)})}/></label>
      <details><summary>Mobile display</summary><label>Width (%)<input type="number" min="1" max="100" placeholder="100" value={item.mobileWidth??''} onChange={e=>patch(item.id,{mobileWidth:e.target.value?Math.max(1,Math.min(100,Number(e.target.value))):null})}/></label><label>Height (px)<input type="number" min="0" max="2000" placeholder="Auto" value={item.mobileHeight??''} onChange={e=>patch(item.id,{mobileHeight:e.target.value?Math.max(0,Math.min(2000,Number(e.target.value))):null})}/></label></details>
      <div className="cyb-media-actions"><button type="button" disabled={busy||!index} onClick={()=>move(index,-1)} aria-label="Move media earlier">↑</button><button type="button" disabled={busy||index===items.length-1} onClick={()=>move(index,1)} aria-label="Move media later">↓</button>{item.type==='image'&&<button type="button" disabled={busy||items.find(entry=>entry.type==='image')===item} onClick={()=>onChange([item,...items.filter(entry=>entry!==item)])}>Make main image</button>}<label className="cyb-media-file-button">Replace<input aria-label={`Replace ${item.alt||item.type}`} type="file" accept={item.type==='video'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/gif'} disabled={busy} onChange={event=>choose(event,item.id)}/></label><button type="button" disabled={busy} onClick={()=>onChange(items.filter((_,i)=>i!==index))}>Remove</button></div>
    </div>)}
  </fieldset>;
}
