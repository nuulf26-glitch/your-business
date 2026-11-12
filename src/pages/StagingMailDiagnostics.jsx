import { useEffect, useState } from 'react';
import { customBackendRequest } from '../services/customBackendSession';

export default function StagingMailDiagnostics() {
  const isStaging=window.location.hostname==='getcyb-staging-web.onrender.com';
  const [status,setStatus]=useState({loading:true,result:null,error:''});
  useEffect(()=>{
    if(!isStaging)return;
    let active=true;
    customBackendRequest('/auth/staging-mail-diagnostic')
      .then(result=>{if(active)setStatus({loading:false,result,error:''});})
      .catch(error=>{if(active)setStatus({loading:false,result:null,error:error.message||'Could not verify staging SMTP.'});});
    return()=>{active=false;};
  },[isStaging]);

  return <main className="min-h-screen bg-[#f7f2eb] px-6 py-12 text-[#18243a]">
    <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">CYB staging</p>
      <h1 className="mt-3 text-2xl font-semibold">Mail delivery diagnostics</h1>
      <p className="mt-2 text-sm text-slate-600">Only configuration presence and SMTP connection status are shown. Secret values and mailbox addresses are never displayed.</p>
      {!isStaging?<p className="mt-6" role="alert">This diagnostic is available only on CYB staging.</p>:status.loading?<p className="mt-6" role="status">Checking Gmail SMTP configuration…</p>:status.error?<p className="mt-6" role="alert">{status.error}</p>:<dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        {Object.entries({
          'Required settings configured':status.result.configured,
          'Missing required settings':status.result.missing.length?status.result.missing.join(', '):'None',
          'Gmail SMTP host':status.result.gmailHost?'Verified':'Different or missing',
          'SMTP port':status.result.supportedPort?'Supported (465 or 587)':'Unsupported or missing',
          'SMTP user present':status.result.smtpUserConfigured?'Yes':'No',
          'SMTP password present':status.result.passwordConfigured?'Yes':'No',
          'MAIL_FROM override present':status.result.mailFromConfigured?'Yes':'No (defaults to SMTP_USER)',
          'SMTP authentication':status.result.authenticated?'Succeeded':`Failed (${status.result.failure}${status.result.errorCode?`, ${status.result.errorCode}`:''}${status.result.responseCode?`, ${status.result.responseCode}`:''})`,
        }).map(([label,value])=><div className="rounded-lg bg-slate-50 p-3" key={label}><dt className="font-medium">{label}</dt><dd className="mt-1 break-words text-slate-600">{String(value)}</dd></div>)}
      </dl>}
    </section>
  </main>;
}
