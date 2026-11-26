import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './landing.css';
import './hero-approved.css';

export default function Hero() {
  const navigate=useNavigate();
  const [idea,setIdea]=useState('');
  const start=()=>navigate(`/try${idea.trim()?`?prompt=${encodeURIComponent(idea.trim())}`:''}`);
  return <section className="approved-home-hero">
    <div className="approved-home-hero__inner">
      <div className="approved-home-hero__badge"><span aria-hidden="true"/>Try CYB before you buy</div>
      <h1 className="approved-home-hero__title">Build your website <span>before you pay.</span></h1>
      <p className="approved-home-hero__description">Describe your business, preview your website, and see what CYB can create before you pay.</p>
      <div className="approved-home-hero__form">
        <input aria-label="Describe your business" value={idea} onChange={event=>setIdea(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')start();}} placeholder="e.g. A minimalist beige skincare store…"/>
        <button type="button" onClick={start}>Build Your Website for Free <span aria-hidden="true">→</span></button>
      </div>
      <p className="approved-home-hero__note">No account or payment required to preview. <button type="button" onClick={()=>navigate('/design-preview')}>Explore sample designs</button></p>
    </div>
    <div className="approved-home-hero__benefits"><span>No coding needed</span><i aria-hidden="true"/><span>Private website preview</span><i aria-hidden="true"/><span>One-time $246 lifetime access</span></div>
  </section>;
}
