import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicCmsCollection } from '../services/cmsService';
import '../styles/publicCms.css';

const plainText = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export default function PublicCmsPage() {
  const { storeUrl = '', collectionSlug = '', '*': path = '' } = useParams();
  const entrySlug = path.split('/').filter(Boolean)[0] || '';
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ key: '', loading: true, error: '' });
  const key = `${storeUrl}/${collectionSlug}/${entrySlug}`;

  useEffect(() => {
    let active = true;
    getPublicCmsCollection(storeUrl, collectionSlug, entrySlug)
      .then(value => { if (active) { setResult(value); setState({ key, loading: false, error: '' }); } })
      .catch(error => { if (active) { setResult(null); setState({ key, loading: false, error: error.message || 'This content is not available.' }); } });
    return () => { active = false; };
  }, [key, storeUrl, collectionSlug, entrySlug]);

  const current = state.key === key;
  const selected = result?.entries?.find(entry => entry.slug === entrySlug);
  const base = `/store/${encodeURIComponent(storeUrl)}/content/${encodeURIComponent(collectionSlug)}`;
  if (!current || state.loading) return <main className="public-cms-state" role="status">Loading content…</main>;
  if (state.error || !result) return <main className="public-cms-state"><h1>Content unavailable</h1><p>{state.error || 'This published collection could not be found.'}</p><Link to={`/store/${encodeURIComponent(storeUrl)}`}>Return to website</Link></main>;

  return <main className="public-cms-page">
    <nav className="public-cms-nav" aria-label="Content navigation"><Link to={`/store/${encodeURIComponent(storeUrl)}`}>{storeUrl}</Link><span>/</span><Link to={base}>{result.collection.name}</Link></nav>
    {entrySlug ? selected ? <article className="public-cms-entry">
      <Link className="public-cms-back" to={base}>← All {result.collection.name}</Link>
      <p className="public-cms-eyebrow">{selected.category || result.collection.name}</p><h1>{selected.title}</h1>
      {Object.entries(selected.content || {}).filter(([keyName]) => keyName !== 'title').map(([keyName, value]) => <ContentField key={keyName} name={keyName} value={value} />)}
      {selected.publishedAt && <time dateTime={selected.publishedAt}>{new Date(selected.publishedAt).toLocaleDateString()}</time>}
    </article> : <section className="public-cms-state"><h1>Story not found</h1><Link to={base}>Browse all content</Link></section> : <>
      <header className="public-cms-heading"><p className="public-cms-eyebrow">{storeUrl}</p><h1>{result.collection.name}</h1></header>
      {result.entries.length ? <div className="public-cms-grid">{result.entries.map(entry => <article className="public-cms-card" key={entry.id}>
        {entry.content?.cover_image && <img src={plainText(entry.content.cover_image)} alt="" loading="lazy" />}
        <p className="public-cms-eyebrow">{entry.category || result.collection.name}</p><h2><Link to={`${base}/${encodeURIComponent(entry.slug)}`}>{entry.title}</Link></h2>
        <p>{plainText(entry.content?.summary || entry.content?.description || entry.content?.body).slice(0, 240)}</p>
        <Link className="public-cms-read" to={`${base}/${encodeURIComponent(entry.slug)}`}>Read more ↗</Link>
      </article>)}</div> : <p className="public-cms-empty">There are no published entries yet.</p>}
    </>}
  </main>;
}

function ContentField({ name, value }) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && /^https?:\/\//i.test(value) && /image|photo|cover/i.test(name)) return <img className="public-cms-cover" src={value} alt="" loading="lazy" />;
  return <section className="public-cms-field"><h2>{name.replace(/[_-]+/g, ' ')}</h2><p>{plainText(value)}</p></section>;
}
