import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleSignIn } from '../services/authService';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const scriptId = 'google-identity-services';

export default function GoogleSignInButton({ acceptedTerms = false }) {
  const host = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    const render = () => {
      if (!active || !host.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (credentialResponse) => {
          setError('');
          try {
            if (!credentialResponse.credential) throw new Error('Google did not return a sign-in credential.');
            await googleSignIn(credentialResponse.credential, acceptedTerms);
            navigate('/dashboard', { replace: true });
          } catch (authError) {
            if (authError.status === 409) setError('An account already exists. Sign in with email and password.');
            else if (authError.status === 503) setError('Google sign-in is not configured on this environment yet.');
            else setError(authError.status === 400 ? authError.message : 'Google sign-in could not be completed. Please try again.');
          }
        },
      });
      window.google.accounts.id.renderButton(host.current, { theme: 'outline', size: 'large', shape: 'rectangular', width: 360, text: 'continue_with' });
    };
    let script = document.getElementById(scriptId);
    if (window.google?.accounts?.id) render();
    else {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      script.addEventListener('error', () => active && setError('Google sign-in could not load. Please try again.'));
    }
    return () => { active = false; script?.removeEventListener('load', render); };
  }, [acceptedTerms, navigate]);

  if (!clientId) return <p className="auth-provider-unavailable">Google sign-in is not configured on this environment.</p>;
  return <div className="auth-provider-wrap">
    <div ref={host} />
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>;
}
