import { businessCall } from '../business/api';
export function analyticsConsentKey(storeUrl){return `cyb-analytics-consent:${storeUrl}`;}
export function grantAnalyticsConsent(storeUrl){try{sessionStorage.setItem(analyticsConsentKey(storeUrl),'granted');}catch{/* Storage can be disabled by the browser. */}}
export function trackWebsiteEvent({storeUrl,type='page_view',page='/'}){
  try{
    if(sessionStorage.getItem(analyticsConsentKey(storeUrl))!=='granted')return Promise.resolve({recorded:false,reason:'consent_required'});
    let sessionId=sessionStorage.getItem(`getcyb-visit:${storeUrl}`);
    if(!sessionId){sessionId=crypto.randomUUID?.()||`visit-${Date.now()}-${Math.random().toString(16).slice(2)}`;sessionStorage.setItem(`getcyb-visit:${storeUrl}`,sessionId);}
    let visitorId;
    try{const saved=JSON.parse(localStorage.getItem(`cyb-analytics-visitor:${storeUrl}`)||'null');if(saved&&saved.expiresAt>Date.now())visitorId=saved.id;}catch{/* Discard unreadable anonymous storage. */}
    if(!visitorId){visitorId=crypto.randomUUID?.()||`visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;try{localStorage.setItem(`cyb-analytics-visitor:${storeUrl}`,JSON.stringify({id:visitorId,expiresAt:Date.now()+30*86400000}));}catch{/* Session counts remain available without persistent storage. */}}
    const key=`cyb-analytics-event:${storeUrl}:${type}:${page}`,now=Date.now();let saved;
    try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{/* Ignore malformed session state. */}
    const eventId=saved&&now-Number(saved.at)<2000?saved.id:(crypto.randomUUID?.()||`event-${now}-${Math.random().toString(16).slice(2)}`);
    sessionStorage.setItem(key,JSON.stringify({id:eventId,at:now}));
    return businessCall('recordAnalyticsEvent',{storeUrl,sessionId,visitorId:visitorId||sessionId,eventId,type,page,referrer:document.referrer});
  }catch{return Promise.resolve({recorded:false});}
}
