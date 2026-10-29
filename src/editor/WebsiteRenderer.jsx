import { productPrice } from "../services/productPolicy";
import { useEffect, useRef, useState } from 'react';
import { safeHref, websitePages } from './pages';
import './website.css';
import MediaDisplay from '../media/MediaDisplay';
import { mediaItems } from '../media/media';
import { sectionStyle } from './sectionStyle';

function Image({ src, alt = '', className = '' }) {
  return src ? <img className={`cyb-image ${className}`} src={src} alt={alt} loading="lazy" /> : null;
}
function Action({ section, children, className = '' }) {
  const href = safeHref(section.href);
  return href ? <a className={`cyb-action ${className}`} href={href}>{children}</a> : null;
}
function SectionContent({ section, model, products = [], addToCart, editText, booking, submitForm, catalog, pickup }) {
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
  if (s.type === 'group') return <div className="cyb-group">{(s.children || []).map(child => <div key={child.id} className={`cyb-section cyb-type-${child.type}`} style={sectionStyle(child,model.renderDevice || 'laptop')}><WebsiteSection section={child} model={model} products={products} addToCart={addToCart} editText={editText} booking={booking} submitForm={submitForm} catalog={catalog} pickup={pickup}/></div>)}</div>;
  if (s.type === 'hero') return <div className={`cyb-hero cyb-variant-${s.variant || 'split'} ${mediaItems(s).length ? 'with-image' : ''}`}><div className="cyb-hero-copy"><p className="cyb-eyebrow">{s.eyebrow || model.tagline || model.brandName}</p>{title('h1')}{body}<Action section={s}>{s.buttonText || 'Explore'} <span aria-hidden="true">↗</span></Action></div><MediaDisplay value={s} title={s.alt || s.title}/><span className="cyb-hero-index" aria-hidden="true">01 / {model.brandName}</span></div>;
  if (s.type === 'about') return <div className="cyb-about"><MediaDisplay value={s} title={s.alt || s.title}/><div><p className="cyb-eyebrow">{s.eyebrow || 'Our story'}</p>{title()}{body}<Action section={s}>{s.buttonText}</Action></div></div>;
  if (s.type === 'services') return <><p className="cyb-eyebrow">What we offer</p>{title()}{body}<div className="cyb-services">{(s.items || []).map((item, index) => <article key={index}><small>0{index + 1}</small><h3>{typeof item === 'string' ? item : item.name}</h3>{item.description && <p>{item.description}</p>}</article>)}</div></>;
  if (s.type === 'menu') return <><p className="cyb-eyebrow">The menu</p>{title()}{body}<div className="cyb-menu">{(s.items || []).map((item, index) => <article key={index}><div><MediaDisplay value={item} title={item.name}/><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{item.allergens && <small>Allergens: {item.allergens}</small>}</div><strong>{item.price}</strong></article>)}</div>{pickup}</>;
  if (s.type === 'booking') return <div className="cyb-booking"><div><p className="cyb-eyebrow">By appointment</p>{title()}{body}</div>{booking || <div className="cyb-note">Online booking is not available yet. <Action section={s}>{s.buttonText || 'Contact us'}</Action></div>}</div>;
  if (s.type === 'gallery') return <>{title()}{body}<MediaDisplay value={s} title={s.title}/></>;
  if (s.type === 'faq') return <>{title()}{body}<div className="cyb-faq">{(s.items || []).map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></>;
  if (s.type === 'reviews') return <>{title()}{body}<div className="cyb-reviews">{(s.items || []).map((item, index) => <blockquote key={index}><p>“{item.quote}”</p><cite>{item.name}</cite></blockquote>)}</div></>;
  if (s.type === 'product') {
    const product = products.find(item => item.id === s.productId || item.legacyId === s.productId);
    const price = product ? productPrice(product) : 0;
    return <div className="cyb-product"><MediaDisplay value={product || s} title={product?.name || s.alt || s.title}/><div><p className="cyb-eyebrow">The collection</p>{title()}{body}{product && <><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price) || 0)}</strong><button className="cyb-action" disabled={!addToCart || product.stock <= 0} onClick={() => addToCart(product)}>{product.stock > 0 ? 'Add to cart' : 'Out of stock'}</button></>}{!product && <p className="cyb-note">Product unavailable.</p>}</div></div>;
  }
  if (s.type === 'collection') { const visibleProducts = Number.isInteger(s.limit) && s.limit > 0 ? products.slice(0, s.limit) : products; return <>{title()}{body}<div className="cyb-shop-grid">{visibleProducts.map(product => <article key={product.id}><MediaDisplay value={product} title={product.name}/><h3>{product.name}</h3><p>{product.description}</p><strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(productPrice(product))}</strong><button className="cyb-action" disabled={!addToCart || product.stock<=0} onClick={()=>addToCart(product)}>{product.stock>0?'Add to cart':'Out of stock'}</button></article>)}</div>{!products.length&&<p className="cyb-note">The collection will be available soon.</p>}</>; }
  if (s.type === 'heading') return title();
  if (s.type === 'text') return body;
  if (s.type === 'button') return <Action section={s}>{s.buttonText || s.title}</Action>;
  if (s.type === 'photo') return <MediaDisplay value={s} title={s.alt || s.title}/>;
  if (s.type === 'chat') return <><h3>{s.title}</h3>{body}{s.email && <a className="cyb-action" href={`mailto:${s.email}`}>Email us ↗</a>}</>;
  if (s.type === 'contact') return <>{title()}{body}<WebsiteForm section={s} submitForm={submitForm} /></>;
  if (s.type === 'divider') return <hr />;
  if (s.type === 'spacer') return <div style={{ minHeight: s.style?.height || 64 }} />;
  if (s.type === 'footer') return <div className="cyb-footer"><div>{title()}{body}</div><small>© {new Date().getFullYear()} {model.brandName}</small></div>;
  return null;
}
export function WebsiteSection(props) {
  const hasOwnMedia=['hero','about','photo','product','gallery'].includes(props.section.type);
  return <><SectionContent {...props}/>{!hasOwnMedia&&<MediaDisplay value={props.section} title={props.section.title}/>}</>;
}
function WebsiteForm({ section, submitForm }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="cyb-form" onSubmit={async event => {
    event.preventDefault(); if (!submitForm) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true); setStatus('');
    try { await submitForm({ ...data, formId: section.id }); setStatus('Thank you. Your message has been received.'); form.reset(); }
    catch { setStatus('Could not send your message. Please try again.'); } finally { setBusy(false); }
  }}><label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Message<textarea name="message" required maxLength={4000} rows={4} /></label><button className="cyb-action" disabled={!submitForm || busy}>{busy ? 'Sending…' : 'Send inquiry'}</button>{!submitForm && <p className="cyb-note">Form preview. Submission is available on the published website when configured.</p>}<p role="status">{status}</p></form>;
}
export default function WebsiteRenderer({ model, products = [], addToCart, baseUrl = '', slug = '', onPageChange, booking, submitForm, catalog, pickup, device = 'auto' }) {
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
  const page = pages.find(item => item.slug === slug);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = page?.seoTitle || `${page?.title || 'Page'} — ${model.brandName}`;
    let description = document.querySelector('meta[name="description"]');
    const created = !description;
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    const previous = description.content;
    description.content = page?.description || model.description || '';
    return () => { document.title = previousTitle; if(created) description.remove(); else description.content = previous; };
  }, [page?.seoTitle, page?.title, page?.description, model.brandName, model.description]);
  return <div ref={rootRef} className={`cyb-site cyb-device-${actualDevice}`} style={{ background: model.backgroundColor || '#f5f2ea', color: model.textColor || '#25231f', '--cyb-primary': model.primaryColor || '#18243a', '--cyb-button-radius': model.buttonRadius || '0', fontFamily: model.bodyFont || 'Arial, sans-serif' }}>
    <header className="cyb-nav"><a href={baseUrl || '#'} className="cyb-logo" onClick={onPageChange ? event => { event.preventDefault(); onPageChange(pages[0]); } : undefined}>{model.logo ? <Image src={model.logo} alt={model.brandName} /> : model.brandName}</a><button className="cyb-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu {menuOpen ? '−' : '+'}</button><nav className={menuOpen ? 'open' : ''} aria-label="Website pages">{pages.map(item => <a key={item.id} href={`${baseUrl}${item.slug ? `/${item.slug}` : ''}` || '#'} aria-current={page?.id === item.id ? 'page' : undefined} onClick={onPageChange ? event => { event.preventDefault(); onPageChange(item); setMenuOpen(false); } : undefined}>{item.title}</a>)}</nav>{addToCart && <a href="/cart" className="cyb-cart">Cart ↗</a>}</header>
    <main>{page ? page.sections.map(section => <section key={section.id} id={section.anchor || section.id} className={`cyb-section cyb-type-${section.type}`} style={sectionStyle(section, actualDevice)}><WebsiteSection section={section} model={{...model,renderDevice:actualDevice}} products={products} addToCart={addToCart} booking={booking} submitForm={submitForm} catalog={catalog} pickup={pickup} /></section>) : <section className="cyb-section"><h1>Page not found</h1><a href={baseUrl}>Return home</a></section>}</main>
  </div>;
}
