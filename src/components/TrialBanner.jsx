import { useEffect, useState } from 'react';
import { businessCall } from '../business/api';
import './trial.css';
export default function TrialBanner({ compact = false }) {
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => businessCall('getBusinessAccess').then(value => { if(active){setAccess(value);setError('');} }).catch(() => { if(active)setError('Account status is temporarily unavailable. Your saved work is safe.'); });
    refresh(); const timer = setInterval(refresh, 60000);
    return () => { active=false;clearInterval(timer); };
  }, []);
  if (error) return <div className="trial-banner" role="status">{error}</div>;
  if (!access || ['active','existing_account','setup_pending'].includes(access.status)) return null;
  return <section className={`trial-banner ${compact ? 'compact' : ''}`} aria-label="Free trial">
    <div><strong>{access.status === 'expired' ? 'Your free trial has ended' : `${access.daysRemaining} ${access.daysRemaining === 1 ? 'day' : 'days'} left in your free trial`}</strong>
    {!compact && <p>{access.status === 'expired' ? 'Your website and data are retained. You can still access and save your draft.' : 'No credit card required. Your website and data will not be deleted when the trial ends.'}</p>}
    {access.status === 'expired' && !access.canPublish && <p>Activate access before publishing new changes.</p>}</div>
    <button type="button" onClick={() => setOptions(value => !value)} aria-expanded={options}>Access options</button>
    {options && <div className="trial-options"><p>Subscription pricing is being finalized. Existing paid accounts keep their access. No automatic charge will be made.</p><a href="/settings">Open account settings</a></div>}
  </section>;
}
