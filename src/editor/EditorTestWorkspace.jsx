// Development-only harness using the actual editor. Never routed in production.
import { useState } from 'react';
import WebsiteEditor from '../pages/WebsiteEditor';
const key = 'getcyb-editor-test-cloud';
const initial = { editorVersion:2,brandName:'Atelier Beauty',backgroundColor:'#f0eade',primaryColor:'#514a3d',textColor:'#302b25',recentColors:['#302b25','#f0eade','#ffffff'],sections:[
  {id:'hero',type:'hero',label:'Hero',eyebrow:'Beauty, with intention',title:'A little time. Entirely yours.',body:'A considered approach to beauty. Discover our treatments and the people behind them.',buttonText:'Explore',href:'#story',variant:'luxury',style:{fontSize:64,fontFamily:'Georgia',color:'#302b25'}},
  {id:'story',type:'about',label:'Our story',title:'Good care begins with listening.',body:'Thoughtful details. Personal attention.',style:{fontSize:38,fontFamily:'Georgia',color:'#302b25'}},
] };
const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{model:initial,revision:0};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const services={previewOnly:true,userId:()=> 'development-fixture',getStore:async()=>({storeUrl:'atelier-beauty'}),getProducts:async()=>[],catalog:async()=>null,loadWebsiteDraft:async()=>read(),
  saveWebsiteDraft:async(model,expected)=>{await pause(150);const stored=read();if(expected!==stored.revision)throw Error('This draft changed in another tab or device. Reload to review and recover your local edits.');const result={model,revision:expected+1};localStorage.setItem(key,JSON.stringify(result));return result;},
  publishSnapshot:async(model,expected)=>{const result=await services.saveWebsiteDraft(model,expected);localStorage.setItem(`${key}:published`,JSON.stringify(model));return {...result,slug:'atelier-beauty'};},
  uploadProductImage:async(file,progress)=>{progress(10);await pause(800);progress(100);return `https://example.test/${file.name}`;},
};
export default function EditorTestWorkspace(){const [generation,setGeneration]=useState(0);return <><div style={{padding:12,background:'#eee7de',font:'12px Arial',display:'flex',gap:16,alignItems:'center'}}><span>LOCAL TEST WORKSPACE · Sample content · No live publishing or uploads</span><button onClick={()=>{localStorage.removeItem(key);localStorage.removeItem('websiteEditorData:development-fixture');setGeneration(value=>value+1);}}>Reset fixture</button><button onClick={()=>{const stored=read();localStorage.setItem(key,JSON.stringify({...stored,revision:stored.revision+1}));}}>Simulate another tab saving</button></div><WebsiteEditor key={generation} services={services}/></>;}
