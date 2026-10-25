import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customBackendRequest } from '../services/customBackendSession';
import '../styles/auth.css';

export default function VerifyEmail() {
  const [params]=useSearchParams();const [status,setStatus]=useState('checking');
  useEffect(()=>{const token=params.get('token');if(!token){setStatus('invalid');return;}let active=true;customBackendRequest('/auth/verify-email',{method:'POST',body:JSON.stringify({token})}).then(()=>{if(active)setStatus('verified');}).catch(()=>{if(active)setStatus('invalid');});return()=>{active=false;};},[params]);
  const verified=status==='verified';
  return <div className="auth-page"><section className="auth-form-panel"><div className="auth-form-wrapper"><Link className="auth-brand-logo" to="/">GETCYB</Link><div className="auth-heading"><span className="auth-eyebrow">Email verification</span><h2>{status==='checking'?'Checking your link…':verified?'Email verified':'This link is unavailable'}</h2><p>{status==='checking'?'Please wait while we verify your email.':verified?'Your email is verified. You can sign in to continue.':'The link may have expired or already been used. Request a fresh verification email and try again.'}</p></div>{status!=='checking'&&<Link className="auth-submit-button" to="/login">Go to log in</Link>}</div></section></div>;
}
