import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  createMarketingCampaign,
  createMarketingContact,
  deleteMarketingCampaign,
  deleteMarketingContact,
  listMarketingCampaigns,
  listMarketingContacts,
  loadMarketingSettings,
  marketingUnsubscribeUrl,
  queueMarketingCampaign,
  reconsentMarketingContact,
  saveMarketingSettings,
  unsubscribeMarketingContact,
} from '../marketing/api';
import '../styles/marketing.css';

const emptyContact = { name: '', email: '', consentSource: '', consented: false };
const emptyCampaign = { name: '', subject: '', content: '' };

export default function Marketing() {
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [settings, setSettings] = useState({ unsubscribedRetentionDays: 365 });
  const [contactForm, setContactForm] = useState(emptyContact);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [contactRows, campaignRows, preferences] = await Promise.all([
        listMarketingContacts(), listMarketingCampaigns(), loadMarketingSettings(),
      ]);
      setContacts(Array.isArray(contactRows) ? contactRows : []);
      setCampaigns(Array.isArray(campaignRows) ? campaignRows : []);
      setSettings(preferences || { unsubscribedRetentionDays: 365 });
    } catch (loadError) {
      setError(loadError.message || 'Marketing tools could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);

  const subscribedCount = useMemo(() => contacts.filter(contact => contact.consentStatus === 'subscribed').length, [contacts]);

  async function addContact(event) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const created = await createMarketingContact(contactForm);
      setContacts(current => [created, ...current]);
      setContactForm(emptyContact);
      setNotice('Contact saved with recorded opt-in.');
    } catch (saveError) { setError(saveError.message || 'Contact could not be saved.'); }
    finally { setSaving(false); }
  }

  async function reconsent(contact) {
    const evidence = window.prompt('Describe where and when this person explicitly opted in again.');
    if (!evidence?.trim()) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await reconsentMarketingContact(contact.id, { consented: true, evidence: evidence.trim() });
      setContacts(current => current.map(item => item.id === contact.id ? updated : item));
      setNotice('The renewed consent is recorded.');
    } catch (saveError) { setError(saveError.message || 'Consent could not be updated.'); }
    finally { setSaving(false); }
  }

  async function optOut(contact) {
    if (!window.confirm(`Unsubscribe ${contact.email} from marketing?`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await unsubscribeMarketingContact(contact.id);
      setContacts(current => current.map(item => item.id === contact.id ? { ...item, consentStatus: 'unsubscribed', unsubscribedAt: new Date().toISOString() } : item));
      setNotice('Contact unsubscribed and suppressed from queued campaign audience selection.');
    } catch (saveError) { setError(saveError.message || 'Contact could not be unsubscribed.'); }
    finally { setSaving(false); }
  }

  async function removeContact(contact) {
    if (!window.confirm(`Permanently remove ${contact.email} from this audience?`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await deleteMarketingContact(contact.id);
      setContacts(current => current.filter(item => item.id !== contact.id));
      setNotice('Contact data removed. An anonymized suppression entry may remain during the configured retention period.');
    } catch (saveError) { setError(saveError.message || 'Contact could not be deleted.'); }
    finally { setSaving(false); }
  }

  async function saveRetention(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const updated = await saveMarketingSettings({ unsubscribedRetentionDays: Number(settings.unsubscribedRetentionDays) });
      setSettings(updated); setNotice('Retention preferences saved. Expired data is purged during authenticated marketing requests.');
      await load();
    } catch (saveError) { setError(saveError.message || 'Retention preference could not be saved.'); }
    finally { setSaving(false); }
  }

  async function saveCampaign(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const campaign = await createMarketingCampaign(campaignForm);
      setCampaigns(current => [campaign, ...current]); setCampaignForm(emptyCampaign);
      setNotice('Campaign saved as a draft. No message has been sent.');
    } catch (saveError) { setError(saveError.message || 'Campaign could not be saved.'); }
    finally { setSaving(false); }
  }

  async function queueCampaign(campaign) {
    if (!window.confirm('Queue a consent-checked campaign plan? This does not dispatch email or contact customers.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await queueMarketingCampaign(campaign.id);
      setCampaigns(current => current.map(item => item.id === campaign.id ? { ...item, status: 'queued', eligibleCount: result.eligibleCount, queuedAt: result.queuedAt } : item));
      setNotice(`Campaign queued for ${result.eligibleCount} opted-in contacts. No messages were sent.`);
    } catch (saveError) { setError(saveError.message || 'Campaign could not be queued.'); }
    finally { setSaving(false); }
  }

  async function removeCampaign(campaign) {
    if (!window.confirm(`Delete draft “${campaign.name}”?`)) return;
    setSaving(true); setError(''); setNotice('');
    try { await deleteMarketingCampaign(campaign.id); setCampaigns(current => current.filter(item => item.id !== campaign.id)); }
    catch (saveError) { setError(saveError.message || 'Draft could not be deleted.'); }
    finally { setSaving(false); }
  }

  return <DashboardLayout><main className="marketing-page">
    <header className="marketing-header"><div><p className="marketing-eyebrow">CUSTOMER RELATIONSHIPS</p><h1>Marketing</h1><p>Manage permission-based contacts and prepare campaigns with consent controls.</p></div><div className="marketing-count"><span>Opted-in contacts</span><strong>{subscribedCount}</strong></div></header>
    <nav className="marketing-tabs" aria-label="Marketing sections">
      <button type="button" aria-pressed={tab === 'contacts'} onClick={() => setTab('contacts')}>Contacts</button>
      <button type="button" aria-pressed={tab === 'campaigns'} onClick={() => setTab('campaigns')}>Campaign drafts</button>
      <button type="button" aria-pressed={tab === 'privacy'} onClick={() => setTab('privacy')}>Privacy & retention</button>
    </nav>
    {error && <p className="marketing-message is-error" role="alert">{error}</p>}
    {notice && <p className="marketing-message" role="status">{notice}</p>}
    {loading ? <p className="marketing-empty" role="status">Loading marketing workspace…</p> : <>
      {tab === 'contacts' && <section className="marketing-grid">
        <form className="marketing-panel marketing-form" onSubmit={addContact}>
          <p className="marketing-eyebrow">PERMISSION FIRST</p><h2>Add a contact</h2>
          <label>Name <span>Optional</span><input value={contactForm.name} maxLength={120} onChange={event => setContactForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Email<input type="email" required autoComplete="email" value={contactForm.email} maxLength={254} onChange={event => setContactForm(current => ({ ...current, email: event.target.value }))} /></label>
          <label>Where was consent collected?<input required minLength={8} maxLength={300} placeholder="For example, website newsletter form" value={contactForm.consentSource} onChange={event => setContactForm(current => ({ ...current, consentSource: event.target.value }))} /></label>
          <label className="marketing-checkbox"><input type="checkbox" checked={contactForm.consented} onChange={event => setContactForm(current => ({ ...current, consented: event.target.checked }))} required />This person explicitly agreed to receive marketing.</label>
          <button className="marketing-primary" type="submit" disabled={saving || !contactForm.consented}>{saving ? 'Saving…' : 'Save opted-in contact'}</button>
          <p className="marketing-note">Consent source and timestamp are stored. Existing unsubscribes require fresh proof before reactivation.</p>
        </form>
        <section className="marketing-panel marketing-list"><div className="marketing-section-heading"><div><p className="marketing-eyebrow">YOUR AUDIENCE</p><h2>Contacts</h2></div><button type="button" onClick={() => void load()} disabled={saving}>Refresh</button></div>
          {contacts.length ? <div className="marketing-contact-list">{contacts.map(contact => <article className="marketing-contact" key={contact.id}>
            <div><strong>{contact.name || contact.email}</strong>{contact.name && <small>{contact.email}</small>}<small>{contact.consentStatus === 'subscribed' ? `Opted in · ${new Date(contact.consentAt).toLocaleDateString()}` : `Unsubscribed · ${contact.unsubscribedAt ? new Date(contact.unsubscribedAt).toLocaleDateString() : 'status recorded'}`}</small>{contact.consentSource && <small>Source: {contact.consentSource}</small>}</div>
            <div className="marketing-contact-actions">{contact.consentStatus === 'subscribed' ? <><button type="button" onClick={() => navigator.clipboard?.writeText(marketingUnsubscribeUrl(contact))}>Copy unsubscribe link</button><button type="button" onClick={() => void optOut(contact)} disabled={saving}>Unsubscribe</button></> : <button type="button" onClick={() => void reconsent(contact)} disabled={saving}>Record fresh consent</button>}<button className="marketing-danger" type="button" onClick={() => void removeContact(contact)} disabled={saving}>Delete</button></div>
          </article>)}</div> : <div className="marketing-empty"><h3>No contacts yet</h3><p>Only add people who have explicitly opted in.</p></div>}
        </section>
      </section>}
      {tab === 'campaigns' && <section className="marketing-grid">
        <form className="marketing-panel marketing-form" onSubmit={saveCampaign}><p className="marketing-eyebrow">CAMPAIGN BUILDER</p><h2>New draft</h2>
          <label>Campaign name<input required maxLength={120} value={campaignForm.name} onChange={event => setCampaignForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Subject<input required maxLength={180} value={campaignForm.subject} onChange={event => setCampaignForm(current => ({ ...current, subject: event.target.value }))} /></label>
          <label>Message<textarea required rows={8} maxLength={10000} value={campaignForm.content} onChange={event => setCampaignForm(current => ({ ...current, content: event.target.value }))} /></label>
          <p className="marketing-note">Audience: opted-in contacts only. Include the <code>{'{{unsubscribe_url}}'}</code> placeholder; any future delivery flow must replace it per contact. CYB does not send or schedule messages here.</p>
          <button className="marketing-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save campaign draft'}</button>
        </form>
        <section className="marketing-panel marketing-list"><div className="marketing-section-heading"><div><p className="marketing-eyebrow">SAVED WORK</p><h2>Campaigns</h2></div><button type="button" onClick={() => void load()} disabled={saving}>Refresh</button></div>
          {campaigns.length ? campaigns.map(campaign => <article className="marketing-campaign" key={campaign.id}><div><strong>{campaign.name}</strong><small>Subject: {campaign.subject}</small><small>Status: <span className={`marketing-status ${campaign.status}`}>{campaign.status}</span>{campaign.status === 'queued' ? ` · ${campaign.eligibleCount || campaign.eligibleCount === 0 ? campaign.eligibleCount : 'consent checked'} eligible` : ''}</small><p>{campaign.content}</p></div><div className="marketing-contact-actions">{campaign.status === 'draft' && <><button type="button" onClick={() => void queueCampaign(campaign)} disabled={saving || !subscribedCount}>Queue consent-checked plan</button><button className="marketing-danger" type="button" onClick={() => void removeCampaign(campaign)} disabled={saving}>Delete draft</button></>}</div></article>) : <div className="marketing-empty"><h3>No campaigns yet</h3><p>Write a draft, review the opted-in audience, then queue a plan. Queuing never contacts customers.</p></div>}
        </section>
      </section>}
      {tab === 'privacy' && <form className="marketing-panel marketing-retention" onSubmit={saveRetention}><p className="marketing-eyebrow">DATA LIFECYCLE</p><h2>Unsubscribe retention</h2><p>Unsubscribed contact details are removed after this period. A one-way suppression hash remains for one additional period to prevent immediate re-import from restoring consent. Expiry is processed during authenticated marketing requests.</p><label>Retention period <select value={settings.unsubscribedRetentionDays} onChange={event => setSettings({ unsubscribedRetentionDays: Number(event.target.value) })}>{[30, 90, 180, 365, 730, 1095, 1825, 3650].map(days => <option value={days} key={days}>{days} days</option>)}</select></label><button className="marketing-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save retention preference'}</button></form>}
    </>}
  </main></DashboardLayout>;
}
