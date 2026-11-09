import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './landing.css';

export default function Hero() {
  const navigate=useNavigate();
  const [idea,setIdea]=useState('');
  const start=()=>navigate(`/signup${idea.trim()?`?businessName=${encodeURIComponent(idea.trim())}`:''}`);
  return <section style={{background:'#f9f8f6',color:'#111',padding:'80px 5% 40px',fontFamily:"'Mograp',sans-serif",borderBottom:'1px solid #e5e5e0'}}>
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#f1f0ec',padding:'6px 14px',borderRadius:20,fontSize:'.85rem',marginBottom:25,color:'#333'}}><span style={{width:6,height:6,background:'#111',borderRadius:'50%'}}/>Try CYB before you buy</div>
      <h1 style={{fontSize:'clamp(2.5rem,5.5vw,4.5rem)',fontWeight:400,lineHeight:1.1,letterSpacing:'-.03em',margin:'0 0 25px',textTransform:'lowercase'}}>Build your website<br/><span style={{color:'#666'}}>before you pay.</span></h1>
      <p style={{maxWidth:650,fontSize:'1.05rem',lineHeight:1.7,color:'#555',margin:'0 0 26px'}}>Create your account, build and preview your website, and activate CYB when you are ready to publish.</p>
      <div style={{display:'grid',gridTemplateColumns:'minmax(220px,520px) auto',gap:12,alignItems:'center',maxWidth:760}}>
        <input aria-label="Describe your business" value={idea} onChange={event=>setIdea(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')start();}} placeholder="e.g. A minimalist beige skincare store…" style={{width:'100%',minHeight:54,padding:'0 16px',border:'1px solid #d8d3cb',background:'#fff',font:'14px Arial,sans-serif'}}/>
        <button type="button" onClick={start} style={{background:'#111',color:'#fff',border:0,padding:'18px 23px',fontSize:'.9rem',fontWeight:500,letterSpacing:'.3px',cursor:'pointer',fontFamily:"'Mograp',sans-serif"}}>Build Your Website for Free →</button>
      </div>
      <p style={{fontSize:12,color:'#666',margin:'12px 0 55px',lineHeight:1.6}}>Create a free account. Pay once when you are ready to publish. <button type="button" onClick={()=>navigate('/design-preview')} style={{background:'none',border:0,textDecoration:'underline',cursor:'pointer',font:'inherit',color:'inherit'}}>Explore sample designs</button></p>
    </div>
    <div style={{maxWidth:1100,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.78rem',color:'#666',borderTop:'1px solid #e5e5e0',paddingTop:25,flexWrap:'wrap',gap:15}}><span>No coding needed</span><span>•</span><span>Website draft before publishing</span><span>•</span><span>One-time $246 lifetime access</span></div>
  </section>;
}
