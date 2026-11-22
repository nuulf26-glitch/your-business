import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { submitPublicUnsubscribe } from '../marketing/api';
import '../styles/marketing.css';

export default function MarketingUnsubscribe() {
  const [params] = useSearchParams();
  const request = useMemo(() => ({
    businessSlug: params.get('businessSlug') || '',
    contactId: params.get('contactId') || '',
    token: params.get('token') || '',
  }), [params]);
  const hasRequest = Boolean(request.businessSlug && request.contactId && request.token);
  const [state, setState] = useState({ status: 'loading', message: 'Processing your request…' });

  useEffect(() => {
    if (!hasRequest) return undefined;
    let active = true;
    submitPublicUnsubscribe(request)
      .then(() => { if (active) setState({ status: 'done', message: 'You have been unsubscribed from this marketing list.' }); })
      .catch(() => { if (active) setState({ status: 'error', message: 'This link could not be verified. Please contact the business directly.' }); });
    return () => { active = false; };
  }, [hasRequest, request]);

  const visibleState = hasRequest ? state : { status: 'error', message: 'This unsubscribe link is incomplete. Please contact the business directly.' };
  return <main className="marketing-unsubscribe"><section className="marketing-unsubscribe-card" aria-labelledby="unsubscribe-title"><p className="marketing-eyebrow">CYB BUSINESS STUDIO</p><h1 id="unsubscribe-title">Email preferences</h1><p role={visibleState.status === 'error' ? 'alert' : 'status'}>{visibleState.message}</p>{visibleState.status === 'loading' && <span className="marketing-loading" aria-hidden="true"/>}<a href="/">Return to the website</a></section></main>;
}
