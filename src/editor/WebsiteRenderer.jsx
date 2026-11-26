import {customerPage} from '../seo/metadata';
import {setDocumentSeo} from '../seo/document';
import { productPrice } from "../services/productPolicy";
import { useEffect, useRef, useState } from 'react';
import { safeHref, websitePages, websiteNavigation } from './pages';
import './website.css';
import MediaDisplay from '../media/MediaDisplay';
import { mediaItems } from '../media/media';
import { sectionStyle } from './sectionStyle';

function Image({ src, alt = '', className = '' }) {
  return src ? <img className={`cyb-image ${className}`} src={src} alt={alt} loading="lazy" /> : null;
}
function Action({ section, children, className = '' }) {
  const href = safeHref(section.href);
  return <a className={`cyb-action ${className}`} href={href || '#'} aria-disabled={!href || undefined} onClick={!href ? event => event.preventDefault() : undefined}>{children}</a>;
}
function SectionContent({ section, model, products = [], addToCart, editText, booking, submitForm, catalog, pickup, selectedId, onSelectSection, onDragSection, onDropSection, dropTarget }) {
  const s = section.dataSource === 'catalog' && catalog ? { ...section,
    ...(section.type === 'menu' ? { items: (catalog.menu || []).filter(item => item.active !== false).map(item => ({ ...item, price: `$${Number(item.price).toFixed(2)}` })) } : {}),
    ...(section.type === 'services' ? { items: (catalog.services || []).filter(item => item.active !== false) } : {}),
    ...(section.type === 'gallery' ? { images: (catalog.projects || []).filter(item => item.active !== false).map(item => item.image).filter(Boolean) } : {})
  } : section;
  const title = (tag = 'h2') => {
    const Tag = tag;
    return <Tag contentEditable={!!editText && !s.locked} suppressContentEditableWarning onBlur={event => editText?.(s.id, 'title', event.currentTarget.textContent)}>{s.title}</Tag>;
  };
  const body = <p className="cyb-body" contentEditable={!!editText && !s.locked} suppressContentEditableWarning onBlur={event => editText?.(s.id, 'body', event.currentTarget.textContent)}>{s.body}</p>;
  if (['group','container','columns'].includes(s.type)) return <div className={`cyb-group cyb-group-${s.type}`} style={s.type==='columns'?{'--cyb-column-count':Math.max(1,Math.min(4,Number(s.columnCount)||2))}:undefined}>{(s.children || []).map(child => <div key={child.id} className={`cyb-section cyb-type-${child.type} ${onSelectSection ? `editor-section ${selectedId===child.id?'selected':''} ${dropTarget?.id===child.id?`drop-${dropTarget.position}`:''}`:''}`} style={sectionStyle(child,model.renderDevice || 'laptop')} onClick={event=>{if(!onSelectSection)return;event.stopPropagation();onSelectSection(child.id);}} onDragOver={event=>{if(!onDropSection)return;event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();onDropSection('over',child.id,event.clientY>=rect.top+rect.height/2?'after':'before');}} onDragLeave={()=>onDropSection?.('leave',child.id)} onDrop={event=>{if(!onDropSection)return;event.preventDefault();event.stopPropagation();onDropSection('drop',child.id);}}><div className="editor-section-label"><span>{child.layerName||child.label||child.type}</span><button type="button" draggable aria-label={`Move ${child.layerName||child.label||child.type}`} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.stopPropagation();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',child.id);onDragSection?.(child.id);}} onDragEnd={()=>onDragSection?.(null)}>⠿</button></div><WebsiteSection section={child} model={model} products={products} addToCart={addToCart} editText={editText} booking={booking} submitForm={submitForm} catalog={catalog} pickup={pickup} selectedId={selectedId} onSelectSection={onSelectSection} onDragSection={onDragSection} onDropSection={onDropSection} dropTarget={dropTarget}/></div>)}</div>;
  if (s.type === 'hero') return <div className={`cyb-hero cyb-variant-${s.variant || 'split'} ${mediaItems(s).length ? 'with-image' : ''}`}><div className="cyb-hero-copy"><p className="cyb-eyebrow">{s.eyebrow || model.tagline || model.brandName}</p>{title('h1')}{body}<Action section={s}>{s.buttonText || 'Explore'} <span aria-hidden="true">↗</span></Action></div><MediaDisplay value={s} title={s.alt || s.title}/><span className="cyb-hero-index" aria-hidden="true">01 / {model.brandName}</span></div>;
  if (s.type === 'about') return <div className="cyb-about"><MediaDisplay value={s} title={s.alt || s.title}/><div><p className="cyb-eyebrow">{s.eyebrow || 'Our story'}</p>{title()}{body}<Action section={s}>{s.buttonText}</Action></div></div>;
  if (s.type === 'services') return <><p className="cyb-eyebrow">What we offer</p>{title()}{body}<div className="cyb-services">{(s.items || []).map((item, index) => <article key={index}><small>0{index + 1}</small><h3>{typeof item === 'string' ? item : item.name}</h3>{item.description && <p>{item.description}</p>}</article>)}</div></>;
  if (s.type === 'menu') return <><p className="cyb-eyebrow">The menu</p>{title()}{body}<div className="cyb-menu">{(s.items || []).map((item, index) => <article key={index}><div><MediaDisplay value={item} title={item.name}/><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{item.allergens && <small>Allergens: {item.allergens}</small>}</div><strong>{item.price}</strong></article>)}</div>{pickup}</>;
  if (s.type === 'booking') return <div className="cyb-booking"><div><p className="cyb-eyebrow">By appointment</p>{title()}{body}</div>{booking || <div className="cyb-note">Online booking is not available yet. <Action section={s}>{s.buttonText || 'Contact us'}</Action></div>}</div>;
  if (s.type === 'cta') return <div className="cyb-cta">{title()}{body}<Action section={s}>{s.buttonText || 'Get in touch'}</Action></div>;
  if (s.type === 'gallery') return <>{title()}{body}<MediaDisplay value={s} title={s.title}/></>;
  if (s.type === 'faq') return <>{title()}{body}<div className="cyb-faq">{(s.items || []).map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></>;
  if (s.type === 'reviews') return <>{title()}{body}<div className="cyb-reviews">{(s.items || []).map((item, index) => <blockquote key={index}><p>“{item.quote}”</p><cite>{item.name}</cite></blockquote>)}</div></>;
  if (s.type === 'product') {
    const product = products.find(item => item.id === s.productId || item.legacyId === s.productId);
    const price = product ? productPrice(product) : 0;
    return <div className="cyb-product"><MediaDisplay value={product || s} title={product?.name || s.alt || s.title}/><div><p className="cyb-eyebrow">The collection</p>{title()}{body}{product && <><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price) || 0)}</strong><button className="cyb-action" disabled={!addToCart || (Array.isArray(product.variants) && product.variants.length ? product.variants.every(variant => variant.stock !== undefined && Number(variant.stock) <= 0) : product.stock !== undefined && Number(product.stock) <= 0)} onClick={() => addToCart(product)}>{Array.isArray(product.variants) && product.variants.length ? 'Choose options' : product.stock !== undefined && Number(product.stock) <= 0 ? 'Out of stock' : 'Add to cart'}</button></>}{!product && <p className="cyb-note">Product unavailable.</p>}</div></div>;
  }
  if (s.type === 'collection') { const visibleProducts = Number.isInteger(s.limit) && s.limit > 0 ? products.slice(0, s.limit) : products; return <>{title()}{body}<div className="cyb-shop-grid">{visibleProducts.map(product => <article key={product.id}><MediaDisplay value={product} title={product.name}/><h3>{product.name}</h3><p>{product.description}</p><strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(productPrice(product))}</strong><button className="cyb-action" disabled={!addToCart || (Array.isArray(product.variants) && product.variants.length ? product.variants.every(variant => variant.stock !== undefined && Number(variant.stock) <= 0) : product.stock !== undefined && Number(product.stock) <= 0)} onClick={()=>addToCart(product)}>{Array.isArray(product.variants) && product.variants.length ? 'Choose options' : product.stock !== undefined && Number(product.stock) <= 0 ? 'Out of stock' : 'Add to cart'}</button></article>)}</div>{!products.length&&<p className="cyb-note">The collection will be available soon.</p>}</>; }
  if (s.type === 'heading') return title();
  if (s.type === 'text') return body;
  if (s.type === 'button') return <Action section={s}>{s.buttonText || s.title}</Action>;
  if (s.type === 'video') return <MediaDisplay value={s} title={s.alt || s.title}/>;
  if (s.type === 'photo') return <MediaDisplay value={s} title={s.alt || s.title}/>;
  if (s.type === 'chat') return <><h3>{s.title}</h3>{body}{s.email && <a className="cyb-action" href={`mailto:${s.email}`}>Email us ↗</a>}</>;
  if (s.type === 'contact') return <>{title()}{body}<WebsiteForm section={s} submitForm={submitForm} /></>;
  if (s.type === 'divider') return <hr />;
  if (s.type === 'spacer') return <div style={{ minHeight: s.style?.height || 64 }} />;
  if (s.type === 'footer') return <div className="cyb-footer"><div>{title()}{body}</div><small>© {new Date().getFullYear()} {model.brandName}</small></div>;
  return null;
}
export function WebsiteSection(props) {
  const hasOwnMedia=['hero','about','photo','product','gallery','video'].includes(props.section.type);
  return <><SectionContent {...props}/>{!hasOwnMedia&&<MediaDisplay value={props.section} title={props.section.title}/>}</>;
}
function WebsiteForm({ section, submitForm }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});
  const fields = Array.isArray(section.formFields) ? section.formFields.slice(0, 12) : [];
  const visibleFields = fields.filter(field => !field.showWhen || String(answers[field.showWhen.fieldId] ?? '') === String(field.showWhen.value));
  const setAnswer = (fieldId, value) => setAnswers(current => {
    const next = { ...current, [fieldId]: value };
    for (const field of fields) if (field.showWhen && String(next[field.showWhen.fieldId] ?? '') !== String(field.showWhen.value)) delete next[field.id];
    return next;
  });
  return <form className="cyb-form" onSubmit={async event => {
    event.preventDefault(); if (!submitForm) return;
    const form = event.currentTarget;
    const data = Object.fromEntries([...new FormData(form)].filter(([key]) => !key.startsWith('custom_')));
    const customAnswers = Object.fromEntries(visibleFields.flatMap(field => {
      const input = form.elements.namedItem(`custom_${field.id}`);
      if (!input) return [];
      if (field.type === 'checkbox') return input.checked ? [[field.id, 'true']] : [];
      return [[field.id, String(input.value || '')]];
    }));
    setBusy(true); setStatus('');
    try { await submitForm({ ...data, formId: section.id, ...(fields.length ? { answers: customAnswers } : {}) }); setStatus('Thank you. Your message has been received.'); form.reset(); setAnswers({}); }
    catch { setStatus('Could not send your message. Please try again.'); } finally { setBusy(false); }
  }}><label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Message<textarea name="message" required maxLength={4000} rows={4} /></label>{visibleFields.map(field => <label key={field.id}>{field.label}{field.type === 'textarea' ? <textarea name={`custom_${field.id}`} required={!!field.required} maxLength={2000} rows={3} value={answers[field.id] || ''} onChange={event => setAnswer(field.id, event.target.value)} /> : field.type === 'select' ? <select name={`custom_${field.id}`} required={!!field.required} value={answers[field.id] || ''} onChange={event => setAnswer(field.id, event.target.value)}><option value="">Choose an option</option>{(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'checkbox' ? <input name={`custom_${field.id}`} type="checkbox" value="true" required={!!field.required} checked={answers[field.id] === 'true'} onChange={event => setAnswer(field.id, event.target.checked ? 'true' : '')} /> : <input name={`custom_${field.id}`} type="text" required={!!field.required} maxLength={2000} value={answers[field.id] || ''} onChange={event => setAnswer(field.id, event.target.value)} />}</label>)}<button className="cyb-action" disabled={!submitForm || busy}>{busy ? 'Sending…' : 'Send inquiry'}</button>{!submitForm && <p className="cyb-note">Form preview. Submission is available on the published website when configured.</p>}<p role="status">{status}</p></form>;
}
export default function WebsiteRenderer({ model, products = [], addToCart, baseUrl = '', slug = '', onPageChange, booking, submitForm, catalog, pickup, device = 'auto', className = '', style, renderSection, editText, selectedId, onSelectSection, onDragSection, onDropSection, dropTarget }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [observedDevice, setObservedDevice] = useState('laptop');
  const rootRef = useRef(null);
  const actualDevice = device === 'auto' ? observedDevice : device;
  useEffect(() => {
    if (device !== 'auto' || !rootRef.current) return;
    const observer = new ResizeObserver(entries => { const width = entries[0].contentRect.width; setObservedDevice(width <= 600 ? 'phone' : width <= 900 ? 'ipad' : 'laptop'); });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  },[device]);
  const pages = websitePages(model);
  const navigation = websiteNavigation(model);
  const page = pages.find(item => item.slug === slug);
  useEffect(() => {
    if (baseUrl && page && location.pathname.startsWith('/store/')) {
      setDocumentSeo(customerPage(model,page,baseUrl + (page.slug ? '/' + encodeURIComponent(page.slug) : '')));
    }
  }, [baseUrl, page, model]);
  return <div ref={rootRef} className={`cyb-site cyb-device-${actualDevice} ${className}`.trim()} style={{ background: model.backgroundColor || '#f5f2ea', color: model.textColor || '#25231f', '--cyb-primary': model.primaryColor || '#18243a', '--cyb-button-radius': model.buttonRadius || '0', fontFamily: model.bodyFont || 'Arial, sans-serif', ...style }}>
    <header className="cyb-nav"><a href={baseUrl || '#'} className="cyb-logo" onClick={onPageChange ? event => { event.preventDefault(); onPageChange(pages[0]); } : undefined}>{model.logo ? <Image src={model.logo} alt={model.brandName} /> : model.brandName}</a><button className="cyb-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu {menuOpen ? '−' : '+'}</button><nav className={menuOpen ? 'open' : ''} aria-label="Website pages">{navigation.map(item => { const target = item.type === 'page' ? pages.find(candidate => candidate.id === item.pageId) : null; if (item.type === 'page' && !target) return null; const href = target ? `${baseUrl}${target.slug ? `/${target.slug}` : ''}` || '#' : safeHref(item.href); return <a key={item.id || `${item.type}:${item.pageId || item.href}`} href={href || '#'} target={item.type === 'external' ? '_blank' : undefined} rel={item.type === 'external' ? 'noopener noreferrer' : undefined} aria-current={target && page?.id === target.id ? 'page' : undefined} onClick={target && onPageChange ? event => { event.preventDefault(); onPageChange(target); setMenuOpen(false); } : undefined}>{item.label || target?.title}</a>; })}</nav>{addToCart && <a href="/cart" className="cyb-cart">Cart ↗</a>}</header>
    <main>{page ? page.sections.map(section => {
      const content = <WebsiteSection section={section} model={{...model,renderDevice:actualDevice}} products={products} addToCart={addToCart} editText={editText} booking={booking} submitForm={submitForm} catalog={catalog} pickup={pickup} selectedId={selectedId} onSelectSection={onSelectSection} onDragSection={onDragSection} onDropSection={onDropSection} dropTarget={dropTarget} />;
      const props = { section, content, device: actualDevice, style: sectionStyle(section, actualDevice) };
      return renderSection ? renderSection(props) : <section key={section.id} id={section.anchor || section.id} className={`cyb-section cyb-type-${section.type}`} style={props.style}>{content}</section>;
    }) : <section className="cyb-section"><h1>Page not found</h1><a href={baseUrl}>Return home</a></section>}</main>
  </div>;
}
