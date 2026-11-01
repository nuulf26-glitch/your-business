import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import WebsiteRenderer from '../editor/WebsiteRenderer';
import { customBackendRequest } from '../services/customBackendSession';
import '../styles/tryWebsite.css';

const SAMPLE_PROMPT = 'Create a luxury skincare store with a minimalist beige design, elegant typography, a product section, and a professional homepage.';
const FONT_CHOICES = ['Georgia, serif', 'Arial, sans-serif', 'Inter, sans-serif', 'Playfair Display, Georgia, serif', 'DM Sans, Arial, sans-serif'];

function updateHome(model, change) {
  const pages = (model.pages || []).map((page, index) => index === 0 ? { ...page, sections: change(page.sections) } : page);
  return { ...model, pages };
}

export default function TryWebsite() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [prompt, setPrompt] = useState(search.get('prompt') || '');
  const [model, setModel] = useState(null);
  const [mode, setMode] = useState('desktop');
  const [busy, setBusy] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [saved, setSaved] = useState(true);
  const editRevision = useRef(0);
  const markDirty = () => { editRevision.current += 1; setSaved(false); };
  const first = model?.pages?.[0]?.sections || [];
  const hero = first.find(section => section.type === 'hero');

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const session = await customBackendRequest('/try/session', { method: 'POST', body: '{}' });
      setExpiresAt(session.expiresAt);
      if (session.generated) {
        const result = await customBackendRequest('/try/preview');
        setModel(result.model);
      }
    } catch (e) { setError(e.message || 'We could not open your preview. Please try again.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { const timer=setTimeout(load,0); return ()=>clearTimeout(timer); }, [load]);

  useEffect(() => {
    if (!model || saved) return;
    const revision=editRevision.current;
    const timer = setTimeout(async () => {
      setSaving(true);
      try { await customBackendRequest('/try/draft', { method: 'PUT', body: JSON.stringify({ model }) }); if(editRevision.current===revision)setSaved(true); setError(''); }
      catch (e) { setError(e.message || 'Your latest change could not be saved.'); }
      finally { setSaving(false); }
    }, 550);
    return () => clearTimeout(timer);
  }, [model, saved]);

  async function generate(event) {
    event.preventDefault(); setGenerating(true); setError('');
    try {
      const result = await customBackendRequest('/try/generate', { method: 'POST', body: JSON.stringify({ prompt: prompt.trim() || SAMPLE_PROMPT }) });
      setModel(result.model); setExpiresAt(result.expiresAt); setSaved(true);
    } catch (e) { setError(e.message || 'We could not create the preview. Please try again.'); }
    finally { setGenerating(false); }
  }

  const setField = (id, key, value) => {
    setModel(current => updateHome(current, sections => sections.map(section => section.id === id ? { ...section, [key]: value } : section)));
    markDirty();
  };
  const reorder = (id, delta) => {
    setModel(current => updateHome(current, sections => {
      const index = sections.findIndex(section => section.id === id), target = index + delta;
      if (index < 0 || target < 0 || target >= sections.length) return sections;
      const next = [...sections]; [next[index], next[target]] = [next[target], next[index]]; return next;
    })); markDirty();
  };

  async function activate() {
    if (!model) return;
    setError(''); setSaving(true);
    try { await customBackendRequest('/try/draft', { method: 'PUT', body: JSON.stringify({ model }) }); setSaved(true); navigate('/signup?activate=1'); }
    catch (e) { setError(e.message || 'Save your preview before creating an account.'); }
    finally { setSaving(false); }
  }

  async function startFresh() {
    setError(''); setBusy(true);
    try { const session=await customBackendRequest('/try/session',{method:'POST',body:'{}'}); setExpiresAt(session.expiresAt); if(session.generated){const preview=await customBackendRequest('/try/preview');setModel(preview.model);setSaved(true);}else{setModel(null);setSaved(true);} }
    catch(e) { setError(e.message||'We could not restart your preview. Please retry.'); }
    finally { setBusy(false); }
  }

  const previewWidth = useMemo(() => mode === 'mobile' ? '390px' : mode === 'tablet' ? '768px' : '100%', [mode]);

  return <main className="try-page">
    <header className="try-header"><Link to="/" className="try-logo">CYB<span> / FREE WEBSITE PREVIEW</span></Link><div className="try-header-actions"><span className="try-save-state" role="status">{saving ? 'Saving…' : saved ? 'Saved securely' : 'Changes pending'}</span><Link to="/login">Log in</Link></div></header>
    {!model ? <section className="try-start">
      <div className="try-start-copy"><span className="try-kicker">A FIRST LOOK AT YOUR FUTURE SITE</span><h1>See your business<br/><em>in a new light.</em></h1><p>Describe what you do. CYB will shape a polished, editable website preview you can explore before you buy.</p><div className="try-facts"><span>01 · One free preview</span><span>02 · Edit your design</span><span>03 · Yours to keep when you join</span></div></div>
      <form className="try-prompt-card" onSubmit={generate}><label htmlFor="try-prompt">What are you building?</label><textarea id="try-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1200} placeholder={SAMPLE_PROMPT} required minLength={8}/><div className="try-prompt-hint">Be specific about your business, style and what you offer.</div>{error && <p className="try-error" role="alert">{error}</p>}<button className="try-primary" disabled={generating || busy || prompt.trim().length < 8}>{generating ? <><span className="try-spinner"/> Curating your preview…</> : 'Build my free preview'} <span>↗</span></button><small>No account or payment required. One preview per visit token. Expires in 7 days.</small></form>
    </section> : <>
      <section className="try-workspace">
        <aside className="try-controls">
          <div className="try-controls-head"><span className="try-kicker">YOUR PREVIEW</span><h1>Make it yours.</h1><p>Changes save automatically and stay private. This preview cannot be published.</p></div>
          <label className="try-field">Business name<input maxLength={80} value={model.brandName || ''} onChange={e => {setModel(current => ({...current, brandName:e.target.value}));markDirty();}}/></label>
          <label className="try-field">Homepage headline<input maxLength={140} value={hero?.title || ''} onChange={e => hero && setField(hero.id,'title',e.target.value)}/></label>
          <label className="try-field">Main button label<input maxLength={60} value={hero?.buttonText || ''} onChange={e => hero && setField(hero.id,'buttonText',e.target.value)}/></label>
          <label className="try-field">Introductory text<textarea maxLength={300} rows={3} value={hero?.body || ''} onChange={e => hero && setField(hero.id,'body',e.target.value)}/></label>
          <div className="try-style-row"><label className="try-field">Accent color<input aria-label="Accent color" type="color" value={model.primaryColor || '#18243a'} onChange={e => {setModel(current => ({...current,primaryColor:e.target.value}));markDirty();}}/></label><label className="try-field">Background<input aria-label="Background color" type="color" value={model.backgroundColor || '#f7f3ec'} onChange={e => {setModel(current => ({...current,backgroundColor:e.target.value}));markDirty();}}/></label></div>
          <label className="try-field">Typography<select value={model.headingFont || FONT_CHOICES[0]} onChange={e => {setModel(current => ({...current,headingFont:e.target.value,bodyFont:e.target.value}));markDirty();}}>{FONT_CHOICES.map(font => <option key={font}>{font}</option>)}</select></label>
          <div className="try-section-list"><strong>Homepage sections</strong>{first.map((section,index)=><div className="try-section-row" key={section.id}><span>{String(index+1).padStart(2,'0')} · {section.label || section.type}</span><div><button type="button" aria-label={`Move ${section.type} up`} disabled={index===0} onClick={()=>reorder(section.id,-1)}>↑</button><button type="button" aria-label={`Move ${section.type} down`} disabled={index===first.length-1} onClick={()=>reorder(section.id,1)}>↓</button></div></div>)}</div>
          {error && <><p className="try-error" role="alert">{error}</p><button type="button" className="try-secondary" onClick={startFresh}>Reload saved preview</button></>}
          <div className="try-activate-card"><span>READY FOR THE NEXT STEP?</span><h2>Love your website?<br/>Make it yours.</h2><p>Activate CYB for a one-time payment of $246 and publish your website.</p><button type="button" className="try-primary" onClick={activate} disabled={saving}>{saving?'Saving your preview…':'Activate CYB'} <span>↗</span></button><small>You’ll create an account, then review and confirm the one-time payment in secure Stripe checkout.</small><button type="button" className="try-secondary" onClick={()=>document.querySelector('.try-controls .try-field input')?.focus()}>Continue editing this preview</button></div>
        </aside>
        <div className="try-preview-panel"><div className="try-preview-toolbar"><div><span className="try-live-dot"/> PRIVATE PREVIEW</div><div className="try-device-tabs" aria-label="Preview size"><button className={mode==='desktop'?'active':''} onClick={()=>setMode('desktop')}>Desktop</button><button className={mode==='tablet'?'active':''} onClick={()=>setMode('tablet')}>Tablet</button><button className={mode==='mobile'?'active':''} onClick={()=>setMode('mobile')}>Mobile</button></div></div><div className={`try-render-stage ${mode}`}><div className="try-render-frame" style={{width:previewWidth}}><WebsiteRenderer model={model} device={mode==='mobile'?'phone':mode==='tablet'?'ipad':'laptop'} style={{'--cyb-preview-heading':model.headingFont||'Georgia, serif'}}/></div></div><div className="try-preview-foot"><span>{saving?'Saving your edits…':saved?'Your changes are saved to this private preview.':'Your edits will save automatically.'}</span><span>{expiresAt ? `Available until ${new Date(expiresAt).toLocaleDateString()}` : 'Private · Not published'}</span></div></div>
      </section>
    </>}
  </main>;
}
