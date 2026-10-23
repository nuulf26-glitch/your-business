import {useMemo,useState} from 'react';
import WebsiteRenderer from '../editor/WebsiteRenderer';
import {DESIGN_COLLECTIONS,collectionWebsite} from '../editor/collections';
import './designPreview.css';
export default function DesignPreview(){
 const [collectionId,setCollectionId]=useState('atelier'),[width,setWidth]=useState('laptop'),[slug,setSlug]=useState('');
 const collection=DESIGN_COLLECTIONS.find(item=>item.id===collectionId);
 const model=useMemo(()=>{
  let index=0;const createSection=type=>({id:`sample-${collectionId}-${++index}`,type,label:type,title:'',body:'',items:[],style:{fontSize:64}});
  const result=collectionWebsite(collection,createSection);
  for(const page of result.pages)for(const section of page.sections){
   section.style={...section.style,color:collection.ink};
   if(section.type==='menu')section.items=[{name:'Seasonal plate',description:'Roasted vegetables, herbs and house dressing',price:'$24'},{name:'House coffee',description:'Single-origin espresso, served your way',price:'$6'},{name:'Something sweet',description:'Ask about our daily bake',price:'$9'}];
   if(section.type==='footer')section.body='Sample business · Replace with your own address and opening hours.';
  }
  return result;
 },[collectionId]);
 return <div className="design-preview"><header className="design-preview-bar"><a href="/">getcyb<span>Design Collections</span></a><div><span className="preview-sample">SAMPLE CONTENT · DESIGN PREVIEW</span><label>Device<select value={width} onChange={event=>setWidth(event.target.value)}><option value="laptop">Laptop</option><option value="ipad">iPad</option><option value="phone">Phone</option></select></label></div></header><nav className="design-preview-tabs" aria-label="Design collections">{DESIGN_COLLECTIONS.map(item=><button type="button" key={item.id} className={item.id===collectionId?'active':''} onClick={()=>{setCollectionId(item.id);setSlug('');}}><small>{item.category}</small><strong>{item.name}</strong><span>↗</span></button>)}</nav><p className="design-preview-disclaimer">Preview of the shared website renderer. Sample business content. Booking, purchases and form submissions are disabled here.</p><div className={`design-preview-frame ${width}`}><WebsiteRenderer model={model} device={width} slug={slug} onPageChange={page=>setSlug(page.slug)}/></div></div>;
}
