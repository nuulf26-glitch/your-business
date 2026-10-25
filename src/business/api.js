import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';
import { customBackendRequest } from '../services/customBackendSession';
const functions = getFunctions(app);
const customSessionEnabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
export async function businessCall(name, data = {}) {
  if(customSessionEnabled){
    if(name==='loadWebsiteDraft'){const result=await customBackendRequest('/websites/draft');return result?.draft??null;}
    if(name==='saveWebsiteDraft')return customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});
    if(name==='publishWebsiteSnapshot'){await customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});return customBackendRequest('/websites/publish',{method:'POST',body:JSON.stringify({model:data.model})});}
    if(name==='listWebsiteVersions')return customBackendRequest('/websites/versions');
    if(name==='unpublishWebsite')return customBackendRequest('/websites/unpublish',{method:'POST'});
    if(name==='loadPublishedWebsite'){const result=await customBackendRequest(`/websites/public/${encodeURIComponent(data.slug)}`);return {model:result.website,storeUrl:result.business.slug};}
  }
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch(error) {
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') throw new Error('Business services are not available yet. Please try again later.');
    throw error;
  }
}
