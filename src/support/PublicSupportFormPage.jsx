import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customBackendRequest } from '../services/customBackendSession';
import '../styles/support-inbox.css';

function newRequestId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID().replaceAll('-', '');
  const bytes = new Uint8Array(32);
  if (!cryptoApi?.getRandomValues) throw new Error('Secure form submission is unavailable in this browser.');
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function PublicSupportFormPage() {
  const { storeUrl = '' } = useParams();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', needsHuman: false });
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await customBackendRequest('/public/support', { method: 'POST', body: JSON.stringify({ data: { ...form, storeUrl, requestId } }) });
      setSent(true); setRequestId(newRequestId());
    } catch (submitError) { setError(submitError.message || 'Your request could not be sent. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="public-support-page"><header><Link to={`/store/${encodeURIComponent(storeUrl)}`} className="public-support-brand">CYB</Link><span>Customer care</span></header><section className="public-support-card"><p className="support-eyebrow">SUPPORT</p><h1>How can we help?</h1><p>Send a private request to this business’s support inbox.</p>{sent ? <div className="public-support-success" role="status"><strong>Your request was sent.</strong><span>The business team can now review your message.</span><button type="button" onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '', needsHuman: false }); }}>Send another request</button></div> : <form onSubmit={submit}>
    <label>Your name<input required maxLength={120} autoComplete="name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
    <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></label>
    <label>Subject<input required maxLength={160} value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} /></label>
    <label>Message<textarea required minLength={5} maxLength={5000} rows={6} value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} /></label>
    <label className="public-support-handoff"><input type="checkbox" checked={form.needsHuman} onChange={event => setForm(current => ({ ...current, needsHuman: event.target.checked }))} />Please have a person review this request</label>
    {error && <p className="support-alert" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button><small>Only the business team can see your message.</small>
  </form>}</section><footer>Secure support request · CYB</footer></main>;
}
