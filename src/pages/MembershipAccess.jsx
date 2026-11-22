import { useEffect, useState } from 'react';
import { loadMemberContent } from '../services/membershipService';
import '../styles/memberships.css';

function takeAccessKey() {
  const match = window.location.hash.match(/(?:^#|&)token=([^&]+)/);
  if (!match) return '';
  const token = decodeURIComponent(match[1]);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return token;
}

export default function MembershipAccess() {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = takeAccessKey();
    Promise.resolve().then(() => {
      if (!token) throw new Error('incomplete');
      return loadMemberContent(token);
    }).then(setContent).catch((accessError) => setError(accessError.message === 'incomplete'
      ? 'This access link is incomplete. Ask the business for a new one.'
      : 'This access link is expired or no longer active. Ask the business for a new one.')).finally(() => setLoading(false));
  }, []);

  return <main className="membership-access-page">
    <div className="membership-access-card">
      <span className="memberships-kicker">MEMBER SPACE</span>
      {loading ? <p role="status">Checking your access…</p> : error ? <><h1>Access unavailable</h1><p role="alert">{error}</p></> : <>
        <p className="membership-access-business">{content.businessName}</p><h1>{content.tierName}</h1>
        {content.description && <p>{content.description}</p>}
        <section className="membership-protected-content"><h2>Your member content</h2>{content.content.length ? content.content.map((item, index) => <article key={`${index}-${item}`}>{item}</article>) : <p>No protected content is available yet.</p>}</section>
        <small>{content.expiresAt ? `Access ends ${new Date(content.expiresAt).toLocaleDateString()}.` : 'Your access remains active until the business updates it.'}</small>
      </>}
    </div>
  </main>;
}
