import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { customBackendRequest } from '../services/customBackendSession';
import '../styles/support-inbox.css';

const labels = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting', closed: 'Closed' };
const api = (path, options) => customBackendRequest(`/support/inbox${path}`, options);
const formatDate = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function SupportInboxPage() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [handoffOnly, setHandoffOnly] = useState(false);
  const [note, setNote] = useState('');
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRows = useCallback(async () => {
    setState('loading');
    try {
      setError('');
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (handoffOnly) params.set('handoff', 'true');
      const data = await api(`?${params}`);
      setRows(Array.isArray(data) ? data : []);
      setState('ready');
    } catch (loadError) {
      setError(loadError.message || 'The inbox could not be loaded.');
      setState('error');
    }
  }, [search, status, handoffOnly]);

  const loadDetail = useCallback(async id => {
    if (!id) { setDetail(null); return; }
    try {
      const data = await api(`/${encodeURIComponent(id)}`);
      setDetail(data);
    } catch (loadError) {
      setError(loadError.message || 'This conversation could not be opened.');
    }
  }, []);

  useEffect(() => { const timer = setTimeout(() => void loadRows(), 0); return () => clearTimeout(timer); }, [loadRows]);
  useEffect(() => { const timer = setTimeout(() => void loadDetail(selectedId), 0); return () => clearTimeout(timer); }, [selectedId, loadDetail]);

  async function updateConversation(patch) {
    if (!detail) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/${encodeURIComponent(detail.id)}`, { method: 'PATCH', body: JSON.stringify({ data: patch }) });
      await Promise.all([loadRows(), loadDetail(detail.id)]);
      setNotice('Conversation updated.');
    } catch (updateError) { setError(updateError.message || 'The conversation could not be updated.'); }
    finally { setBusy(false); }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!detail || !note.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/${encodeURIComponent(detail.id)}/notes`, { method: 'POST', body: JSON.stringify({ data: { note } }) });
      setNote('');
      await loadDetail(detail.id);
      setNotice('Private note added.');
    } catch (noteError) { setError(noteError.message || 'The note could not be saved.'); }
    finally { setBusy(false); }
  }

  return <DashboardLayout><main className="support-page">
    <header className="support-heading"><div><p className="support-eyebrow">CUSTOMER CARE</p><h1>Support inbox</h1><p>Review website requests, assign them to yourself, and keep private team notes.</p></div><button type="button" className="support-refresh" onClick={() => { void loadRows(); if (selectedId) void loadDetail(selectedId); }}>Refresh inbox</button></header>
    {error && <p className="support-alert" role="alert">{error}</p>}{notice && <p className="support-notice" role="status">{notice}</p>}
    <section className="support-workspace" aria-label="Support conversations">
      <div className="support-list-panel">
        <div className="support-filters"><label className="support-search">Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, or subject" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="support-check"><input type="checkbox" checked={handoffOnly} onChange={event => setHandoffOnly(event.target.checked)} />Needs a person</label></div>
        <div className="support-list" aria-live="polite">
          {state === 'loading' && <p className="support-empty" role="status">Loading conversations…</p>}
          {state === 'error' && <button className="support-retry" type="button" onClick={() => void loadRows()}>Try again</button>}
          {state === 'ready' && rows.length === 0 && <div className="support-empty"><strong>Your inbox is clear</strong><span>New website requests will appear here.</span></div>}
          {rows.map(row => <button type="button" key={row.id} className={`support-ticket${selectedId === row.id ? ' selected' : ''}`} onClick={() => setSelectedId(row.id)} aria-pressed={selectedId === row.id}>
            <span className="support-ticket-top"><strong>{row.subject}</strong>{row.requiresHuman && <span className="support-handoff-badge">Human handoff</span>}</span><span>{row.customerName}</span><small>{labels[row.status] || row.status} · {formatDate(row.lastMessageAt || row.createdAt)}</small>
          </button>)}
        </div>
      </div>
      <section className="support-detail-panel" aria-label="Conversation details">
        {!detail ? <div className="support-empty support-detail-empty"><strong>Select a request</strong><span>Customer messages and private notes stay within this business.</span></div> : <>
          <header className="support-detail-header"><div><p className="support-eyebrow">WEBSITE REQUEST</p><h2>{detail.subject}</h2><p>{detail.name} · <a href={`mailto:${detail.email || ''}`}>{detail.email}</a></p><small>Received {formatDate(detail.createdAt)}</small></div><label>Status<select aria-label="Conversation status" disabled={busy} value={detail.status} onChange={event => void updateConversation({ status: event.target.value })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></header>
          <div className="support-actions"><button type="button" disabled={busy} onClick={() => void updateConversation(detail.assignedToUserId ? { assignedToUserId: null } : { assignToMe: true })}>{detail.assignedToUserId ? 'Unassign from me' : 'Assign to me'}</button><label><input type="checkbox" checked={Boolean(detail.requiresHuman)} disabled={busy} onChange={event => void updateConversation({ requiresHuman: event.target.checked, handoffReason: event.target.checked ? 'Merchant requested follow-up.' : null })} />Human handoff</label></div>
          <ol className="support-messages" aria-label="Conversation history">{(detail.messages || []).map(message => <li key={message.id} className={message.kind === 'internal_note' ? 'internal' : 'customer'}><span>{message.kind === 'internal_note' ? 'Private note' : 'Customer message'}</span><p>{message.body}</p><time dateTime={message.at}>{formatDate(message.at)}</time></li>)}</ol>
          <form className="support-note-form" onSubmit={addNote}><label htmlFor="support-internal-note">Private note</label><textarea id="support-internal-note" value={note} onChange={event => setNote(event.target.value)} maxLength={4000} rows={3} placeholder="Add a note for your team. The customer will not see it." /><button type="submit" disabled={busy || !note.trim()}>{busy ? 'Saving…' : 'Add private note'}</button></form>
        </>}
      </section>
    </section>
  </main></DashboardLayout>;
}
