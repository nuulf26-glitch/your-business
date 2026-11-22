import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  createMembershipTier,
  getMembershipEntitlements,
  getMembershipTiers,
  grantMembershipEntitlement,
  revokeMembershipEntitlement,
  updateMembershipTier,
} from '../services/membershipService';
import '../styles/memberships.css';

const emptyTier = { name: '', description: '', protectedContent: '' };

function accessLink(token) {
  return `${window.location.origin}/memberships/access#token=${encodeURIComponent(token)}`;
}

export default function Memberships() {
  const [tiers, setTiers] = useState([]);
  const [members, setMembers] = useState([]);
  const [tierForm, setTierForm] = useState(emptyTier);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', tierId: '', endsAt: '' });
  const [issuedLink, setIssuedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeTiers = useMemo(() => tiers.filter((tier) => tier.status === 'active'), [tiers]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextTiers, nextMembers] = await Promise.all([getMembershipTiers(), getMembershipEntitlements()]);
      setTiers(Array.isArray(nextTiers) ? nextTiers : []);
      setMembers(Array.isArray(nextMembers) ? nextMembers : []);
      setMemberForm((current) => ({ ...current, tierId: current.tierId || nextTiers?.find((tier) => tier.status === 'active')?.id || '' }));
    } catch (loadError) {
      setError(loadError.message || 'Memberships could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { Promise.resolve().then(load); }, []);

  async function submitTier(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createMembershipTier({
        name: tierForm.name,
        description: tierForm.description,
        protectedContent: tierForm.protectedContent.split('\n').map((line) => line.trim()).filter(Boolean),
      });
      setTierForm(emptyTier);
      setNotice('Membership tier created.');
      await load();
    } catch (submitError) {
      setError(submitError.message || 'Tier could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMember(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setIssuedLink('');
    try {
      const result = await grantMembershipEntitlement({ ...memberForm, endsAt: memberForm.endsAt ? new Date(`${memberForm.endsAt}T23:59:59`).toISOString() : undefined });
      setIssuedLink(accessLink(result.accessToken));
      setMemberForm((current) => ({ ...current, name: '', email: '', endsAt: '' }));
      setNotice(`Manual access granted to ${result.name}. Copy the private access link now; it is only shown once.`);
      await load();
    } catch (submitError) {
      setError(submitError.message || 'Access could not be granted.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTier(tier) {
    setBusy(true);
    setError('');
    try {
      await updateMembershipTier(tier.id, { active: tier.status !== 'active' });
      await load();
    } catch (updateError) {
      setError(updateError.message || 'Tier status could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(member) {
    setBusy(true);
    setError('');
    try {
      await revokeMembershipEntitlement(member.id);
      setNotice(`Access for ${member.name} was revoked.`);
      await load();
    } catch (revokeError) {
      setError(revokeError.message || 'Member access could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(issuedLink);
      setNotice('Private member link copied.');
    } catch {
      setError('Copy is unavailable in this browser. Select and copy the link manually.');
    }
  }

  return <DashboardLayout><main className="memberships-page">
    <header className="memberships-header">
      <div><span className="memberships-kicker">MEMBER ACCESS</span><h1>Memberships</h1><p>Create tiers and manage protected member access.</p></div>
      <span className="memberships-mode">Manual access · no billing connected</span>
    </header>
    {error && <p className="memberships-alert" role="alert">{error}</p>}
    {notice && <p className="memberships-notice" role="status">{notice}</p>}
    {issuedLink && <section className="membership-issued" aria-label="New member access link"><label htmlFor="membership-link">Private link · copy it now</label><div><input id="membership-link" readOnly value={issuedLink} onFocus={(event) => event.target.select()} /><button type="button" onClick={copyLink}>Copy link</button></div><small>The access key is not saved in the database and cannot be shown again.</small></section>}
    <div className="memberships-grid">
      <section className="membership-panel">
        <div className="membership-section-heading"><div><span className="memberships-kicker">ACCESS LEVELS</span><h2>Membership tiers</h2></div><span>{tiers.length} total</span></div>
        <form className="membership-form" onSubmit={submitTier}>
          <label>Tier name<input value={tierForm.name} maxLength={100} onChange={(event) => setTierForm({ ...tierForm, name: event.target.value })} required /></label>
          <label>Description<textarea value={tierForm.description} maxLength={1000} rows={2} onChange={(event) => setTierForm({ ...tierForm, description: event.target.value })} /></label>
          <label>Protected content <span>One text block per line</span><textarea value={tierForm.protectedContent} maxLength={3000} rows={4} onChange={(event) => setTierForm({ ...tierForm, protectedContent: event.target.value })} placeholder="Member resource or benefit" /></label>
          <p className="membership-helper">Access is granted manually. Payment and recurring subscriptions are not enabled.</p>
          <button className="membership-primary" type="submit" disabled={busy}>Create tier</button>
        </form>
        <div className="membership-tier-list">
          {loading ? <p className="membership-empty" role="status">Loading tiers…</p> : tiers.length ? tiers.map((tier) => <article className="membership-tier" key={tier.id}>
            <div><div className="membership-tier-title"><h3>{tier.name}</h3><span className={`membership-status ${tier.status}`}>{tier.status}</span></div><p>{tier.description || 'No description added.'}</p><small>{tier.protectedContent?.length || 0} protected content blocks</small></div>
            <button type="button" disabled={busy} onClick={() => toggleTier(tier)}>{tier.status === 'active' ? 'Pause tier' : 'Activate tier'}</button>
          </article>) : <p className="membership-empty">No tiers yet. Create one to define member access.</p>}
        </div>
      </section>
      <section className="membership-panel">
        <div className="membership-section-heading"><div><span className="memberships-kicker">MANUAL ENTITLEMENTS</span><h2>Grant member access</h2></div></div>
        <form className="membership-form" onSubmit={submitMember}>
          <label>Member name<input value={memberForm.name} maxLength={120} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} required /></label>
          <label>Email<input type="email" value={memberForm.email} maxLength={254} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} required /></label>
          <label>Tier<select value={memberForm.tierId} onChange={(event) => setMemberForm({ ...memberForm, tierId: event.target.value })} required><option value="">Choose a tier</option>{activeTiers.map((tier) => <option value={tier.id} key={tier.id}>{tier.name}</option>)}</select></label>
          <label>Access ends <span>Optional</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={memberForm.endsAt} onChange={(event) => setMemberForm({ ...memberForm, endsAt: event.target.value })} /></label>
          <p className="membership-helper">The private link grants access to the selected tier’s protected content until it is revoked or expires.</p>
          <button className="membership-primary" type="submit" disabled={busy || !activeTiers.length}>Grant access</button>
        </form>
      </section>
    </div>
    <section className="membership-panel membership-roster">
      <div className="membership-section-heading"><div><span className="memberships-kicker">MEMBERS</span><h2>Access roster</h2></div><span>{members.length} records</span></div>
      {loading ? <p className="membership-empty" role="status">Loading members…</p> : members.length ? <div className="membership-table-wrap"><table><thead><tr><th>Member</th><th>Tier</th><th>Status</th><th>Access ends</th><th>Action</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.email}</small></td><td>{member.tierName}</td><td><span className={`membership-status ${member.status}`}>{member.status}</span></td><td>{member.endsAt ? new Date(member.endsAt).toLocaleDateString() : 'No expiry'}</td><td>{member.status === 'active' && <button className="membership-danger" type="button" disabled={busy} onClick={() => revoke(member)}>Revoke access</button>}</td></tr>)}</tbody></table></div> : <p className="membership-empty">No member access has been granted yet.</p>}
    </section>
  </main></DashboardLayout>;
}
