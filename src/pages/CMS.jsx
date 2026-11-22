import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { archiveCmsCollection, archiveCmsEntry, createCmsCollection, createCmsEntry, listCmsCollections, listCmsEntries, publishCmsEntry, unpublishCmsEntry, updateCmsEntry } from '../services/cmsService';
import '../styles/cms.css';

const FIELD_TYPES = ['text', 'longText', 'number', 'date', 'url', 'image', 'boolean'];
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const collectionTemplates = {
  blog: { name: 'Blog Posts', slug: 'blog', description: 'Stories, ideas, and updates.', categories: ['News', 'Stories', 'Guides'], fields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'summary', label: 'Summary', type: 'longText', required: false }, { key: 'body', label: 'Body', type: 'longText', required: true }, { key: 'cover_image', label: 'Cover image', type: 'image', required: false }] },
  team: { name: 'Team', slug: 'team', description: 'People and their roles.', categories: [], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'role', label: 'Role', type: 'text', required: true }, { key: 'bio', label: 'Biography', type: 'longText', required: false }, { key: 'photo', label: 'Photo', type: 'image', required: false }] },
  events: { name: 'Events', slug: 'events', description: 'Upcoming and past events.', categories: ['Upcoming', 'Past'], fields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'location', label: 'Location', type: 'text', required: false }, { key: 'description', label: 'Description', type: 'longText', required: false }] },
};
const emptyCollection = (preset = 'blog') => ({ ...collectionTemplates[preset], categoriesText: collectionTemplates[preset].categories.join(', ') });

export default function CMS() {
  const [collections, setCollections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [entries, setEntries] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [collectionForm, setCollectionForm] = useState(null);
  const [entryForm, setEntryForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selected = useMemo(() => collections.find((row) => row.id === selectedId) || null, [collections, selectedId]);

  async function loadCollections(preferredId = selectedId) {
    const rows = await listCmsCollections();
    setCollections(Array.isArray(rows) ? rows : []);
    const next = rows.find((row) => row.id === preferredId)?.id || rows[0]?.id || '';
    setSelectedId(next);
    if (!next) setEntries([]);
    return next;
  }

  async function loadEntries(collectionId = selectedId) {
    if (!collectionId) { setEntries([]); return; }
    const rows = await listCmsEntries(collectionId);
    setEntries(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    let mounted = true;
    listCmsCollections().then((rows) => {
      if (!mounted) return;
      const safeRows = Array.isArray(rows) ? rows : [];
      setCollections(safeRows);
      setSelectedId(safeRows[0]?.id || '');
    }).catch((reason) => { if (mounted) setError(reason.message || 'Collections could not be loaded.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!selectedId) return () => { mounted = false; };
    listCmsEntries(selectedId).then((rows) => { if (mounted) setEntries(Array.isArray(rows) ? rows : []); })
      .catch((reason) => { if (mounted) setError(reason.message || 'Entries could not be loaded.'); });
    return () => { mounted = false; };
  }, [selectedId]);

  function newEntry() {
    const fields = selected?.fields || [];
    setActiveEntry(null);
    setEntryForm({ title: '', slug: '', content: Object.fromEntries(fields.map((field) => [field.key, field.type === 'boolean' ? false : ''])) });
    setError(''); setMessage('');
  }

  function editEntry(entry) {
    setActiveEntry(entry);
    setEntryForm({ title: entry.title || '', slug: entry.slug || '', category: entry.category || '', content: { ...(entry.content || {}) } });
    setError(''); setMessage('');
  }

  async function saveCollection(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const { categoriesText, ...form } = collectionForm;
      const created = await createCmsCollection({ ...form, categories: categoriesText.split(',').map((name) => name.trim()).filter(Boolean), slug: collectionForm.slug || slugify(collectionForm.name) });
      await loadCollections(created.id); setCollectionForm(null); setMessage('Collection created.');
    } catch (reason) { setError(reason.message || 'Collection could not be saved.'); }
    finally { setBusy(false); }
  }

  async function saveEntry(event) {
    event.preventDefault(); if (!selected || !entryForm) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const content = { ...entryForm.content };
      if ((selected.fields || []).some((field) => field.key === 'title')) content.title = content.title || entryForm.title;
      const payload = { ...entryForm, content };
      const saved = activeEntry
        ? await updateCmsEntry(activeEntry.id, payload)
        : await createCmsEntry(selected.id, { ...payload, slug: payload.slug || slugify(payload.title) });
      await loadEntries(selected.id); setActiveEntry(saved); setEntryForm({ title: saved.title, slug: saved.slug, category: saved.category || '', content: { ...(saved.content || {}) } }); setMessage(saved.status === 'published' ? 'Changes saved as a draft. Publish them when ready.' : 'Draft saved.');
    } catch (reason) { setError(reason.message || 'Entry could not be saved.'); }
    finally { setBusy(false); }
  }

  async function changePublication(action) {
    if (!activeEntry) return;
    setError(''); setBusy(true);
    try {
      const updated = await (action === 'publish' ? publishCmsEntry(activeEntry.id) : unpublishCmsEntry(activeEntry.id));
      await loadEntries();
      setActiveEntry(updated);
      setMessage(action === 'publish' ? 'Entry published.' : 'Entry returned to draft.');
    } catch (reason) { setError(reason.message || 'Publication status could not be changed.'); }
    finally { setBusy(false); }
  }

  async function archiveEntry(entry) {
    if (!window.confirm(`Archive “${entry.title}”?`)) return;
    setBusy(true); setError('');
    try { await archiveCmsEntry(entry.id); await loadEntries(); if (activeEntry?.id === entry.id) { setActiveEntry(null); setEntryForm(null); } setMessage('Entry archived.'); }
    catch (reason) { setError(reason.message || 'Entry could not be archived.'); }
    finally { setBusy(false); }
  }

  async function archiveCollection() {
    if (!selected || !window.confirm(`Archive the “${selected.name}” collection? Published entries in it will no longer appear on the public site.`)) return;
    setBusy(true); setError('');
    try { await archiveCmsCollection(selected.id); setActiveEntry(null); setEntryForm(null); await loadCollections(''); setMessage('Collection archived.'); }
    catch (reason) { setError(reason.message || 'Collection could not be archived.'); }
    finally { setBusy(false); }
  }

  function addField() {
    setCollectionForm((current) => ({ ...current, fields: [...current.fields, { key: `field_${current.fields.length + 1}`, label: '', type: 'text', required: false }] }));
  }

  function fieldControl(field) {
    const value = entryForm?.content?.[field.key] ?? (field.type === 'boolean' ? false : '');
    const update = (next) => setEntryForm((current) => ({ ...current, content: { ...current.content, [field.key]: next } }));
    if (field.type === 'longText') return <textarea id={`cms-field-${field.key}`} value={value} rows={4} maxLength={12000} required={field.required} onChange={(event) => update(event.target.value)} />;
    if (field.type === 'boolean') return <select id={`cms-field-${field.key}`} value={String(Boolean(value))} onChange={(event) => update(event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>;
    if (field.type === 'image') return <><input id={`cms-field-${field.key}`} type="url" inputMode="url" value={value} required={field.required} onChange={(event) => update(event.target.value)} placeholder="https://…" />{value && <img className="cms-image-preview" src={value} alt="Entry media preview" loading="lazy" />}</>;
    const type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text';
    return <input id={`cms-field-${field.key}`} type={type} value={value} required={field.required} onChange={(event) => update(type === 'number' ? event.target.value : event.target.value)} />;
  }

  return <DashboardLayout><main className="cms-page">
    <header className="cms-header"><div><span className="cms-eyebrow">CONTENT STUDIO</span><h1>CMS & Blog</h1><p>Create collections and manage content without changing published pages until you publish an entry.</p></div><button type="button" className="cms-primary" onClick={() => { setCollectionForm(emptyCollection()); setError(''); }}>New collection</button></header>
    {error && <div className="cms-alert" role="alert">{error}</div>}
    {message && <div className="cms-message" role="status">{message}</div>}
    {loading ? <div className="cms-state" role="status">Loading your collections…</div> : collectionForm ? <section className="cms-panel cms-builder">
      <div className="cms-panel-heading"><div><span className="cms-eyebrow">CUSTOM CMS BUILDER</span><h2>New collection</h2></div><button type="button" className="cms-quiet" onClick={() => setCollectionForm(null)}>Cancel</button></div>
      <form onSubmit={saveCollection}>
        <div className="cms-template-picker" aria-label="Ready-made collection templates"><span>Start from a template</span>{Object.entries(collectionTemplates).map(([key, template]) => <button type="button" key={key} className={collectionForm.name === template.name ? 'selected' : ''} onClick={() => setCollectionForm(emptyCollection(key))}>{template.name}</button>)}</div>
        <div className="cms-form-grid"><label>Collection name<input value={collectionForm.name} required maxLength={80} onChange={(event) => setCollectionForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} /></label><label>Public URL slug<input value={collectionForm.slug} required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={(event) => setCollectionForm((current) => ({ ...current, slug: event.target.value }))} /></label><label>Categories, separated by commas<input value={collectionForm.categoriesText} maxLength={1000} placeholder="News, Stories, Guides" onChange={(event) => setCollectionForm((current) => ({ ...current, categoriesText: event.target.value }))} /></label><label className="cms-wide">Description<textarea rows={2} value={collectionForm.description} maxLength={500} onChange={(event) => setCollectionForm((current) => ({ ...current, description: event.target.value }))} /></label></div>
        <div className="cms-builder-title"><div><h3>Fields</h3><p>Choose the fields each entry should contain.</p></div><button type="button" className="cms-quiet" disabled={collectionForm.fields.length >= 30} onClick={addField}>Add field</button></div>
        <div className="cms-fields">{collectionForm.fields.map((field, index) => <div className="cms-field-row" key={index}><label>Label<input value={field.label} required maxLength={80} onChange={(event) => setCollectionForm((current) => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, label: event.target.value, key: item.key.startsWith('field_') ? slugify(event.target.value).replace(/-/g, '_').slice(0, 40) : item.key } : item) }))} /></label><label>Field key<input value={field.key} required pattern="[a-z][a-z0-9_]{0,39}" onChange={(event) => setCollectionForm((current) => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, key: event.target.value } : item) }))} /></label><label>Type<select value={field.type} onChange={(event) => setCollectionForm((current) => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, type: event.target.value } : item) }))}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type === 'longText' ? 'Long text' : type[0].toUpperCase() + type.slice(1)}</option>)}</select></label><label className="cms-required"><input type="checkbox" checked={field.required} onChange={(event) => setCollectionForm((current) => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, required: event.target.checked } : item) }))} /> Required</label>{collectionForm.fields.length > 1 && <button type="button" className="cms-remove" aria-label={`Remove ${field.label || 'field'}`} onClick={() => setCollectionForm((current) => ({ ...current, fields: current.fields.filter((_, i) => i !== index) }))}>Remove</button>}</div>)}</div>
        <div className="cms-actions"><button className="cms-primary" disabled={busy}>{busy ? 'Creating…' : 'Create collection'}</button></div>
      </form>
    </section> : collections.length === 0 ? <section className="cms-empty"><span className="cms-empty-icon">✳</span><h2>Your content starts here</h2><p>Create a collection for blog posts, stories, menus, team profiles, or another structured content type.</p><button type="button" className="cms-primary" onClick={() => setCollectionForm(emptyCollection())}>Create first collection</button></section> : <div className="cms-workspace">
      <aside className="cms-collections"><div className="cms-panel-heading"><div><span className="cms-eyebrow">YOUR CONTENT</span><h2>Collections</h2></div><button type="button" aria-label="Create collection" className="cms-add" onClick={() => setCollectionForm(emptyCollection())}>+</button></div>
        {collections.map((collection) => <button type="button" key={collection.id} className={`cms-collection ${selectedId === collection.id ? 'selected' : ''}`} onClick={() => { setSelectedId(collection.id); setActiveEntry(null); setEntryForm(null); }}><strong>{collection.name}</strong><small>/{collection.slug}</small><span>CMS collection</span></button>)}
      </aside>
      <section className="cms-panel cms-content-panel">
        {selected && <><div className="cms-panel-heading"><div><span className="cms-eyebrow">/{selected.slug}</span><h2>{selected.name}</h2><p>{selected.description || 'Manage drafts and published entries.'}</p></div><button type="button" className="cms-danger-quiet" disabled={busy} onClick={archiveCollection}>Archive collection</button></div>
          <div className="cms-content-grid"><div className="cms-entry-list"><div className="cms-list-heading"><h3>Entries <span>{entries.length}</span></h3><button type="button" className="cms-primary" onClick={newEntry}>New entry</button></div>
            {entries.length ? entries.map((entry) => <article className={`cms-entry-item ${activeEntry?.id === entry.id ? 'selected' : ''}`} key={entry.id}><button type="button" className="cms-entry-select" onClick={() => editEntry(entry)}><strong>{entry.title}</strong><small>{entry.slug}</small></button><span className={`cms-status ${entry.status}`}>{entry.status === 'published' ? 'Published' : 'Draft'}</span><button type="button" className="cms-remove" disabled={busy} onClick={() => archiveEntry(entry)}>Archive</button></article>) : <p className="cms-inline-empty">No entries yet. Add your first one.</p>}
          </div>
          <div className="cms-editor">{entryForm ? <form onSubmit={saveEntry}><div className="cms-editor-heading"><div><span className="cms-eyebrow">{activeEntry ? 'EDIT ENTRY' : 'NEW ENTRY'}</span><h3>{activeEntry?.title || 'Untitled entry'}</h3></div><button type="button" className="cms-quiet" onClick={() => { setEntryForm(null); setActiveEntry(null); }}>Close</button></div>
            <label>Entry title<input value={entryForm.title} required maxLength={160} onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} /></label><label>Public URL slug<input value={entryForm.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} onChange={(event) => setEntryForm((current) => ({ ...current, slug: event.target.value }))} /></label>
            {(selected.categories || []).length > 0 && <label>Category<select value={entryForm.category || ''} required onChange={(event) => setEntryForm((current) => ({ ...current, category: event.target.value }))}><option value="">Choose a category</option>{selected.categories.map((category) => <option key={category}>{category}</option>)}</select></label>}
            {(selected.fields || []).map((field) => <label key={field.key}>{field.label}{field.required && <span aria-hidden="true"> *</span>}{fieldControl(field)}</label>)}
            {activeEntry?.publishedAt && <p className="cms-published-at">Published {new Date(activeEntry.publishedAt).toLocaleString()}</p>}
            <div className="cms-actions"><button className="cms-primary" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>{activeEntry && <button type="button" className="cms-quiet" disabled={busy} onClick={() => changePublication(activeEntry.status === 'published' ? 'unpublish' : 'publish')}>{activeEntry.status === 'published' ? 'Unpublish' : 'Publish'}</button>}</div>
          </form> : <div className="cms-editor-empty"><span>✳</span><h3>Select an entry</h3><p>Choose an entry to edit, or create a new one. Saving a change always returns published content to draft.</p></div>}</div></div>
        </>}
      </section>
    </div>}
  </main></DashboardLayout>;
}
