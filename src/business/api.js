import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';
import { customBackendRequest } from '../services/customBackendSession';
const functions = getFunctions(app);
const customSessionEnabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
export async function businessCall(name, data = {}) {
  if(customSessionEnabled){
    if(name==='loadWebsiteDraft'){
      const result=await customBackendRequest('/websites/draft');if(result?.draft)return result.draft;
      const legacy=(await httpsCallable(functions,name)({})).data;
      if(legacy)await customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:legacy})});
      return legacy;
    }
    if(name==='saveWebsiteDraft')return customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});
    if(name==='publishWebsiteSnapshot'){await customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});return customBackendRequest('/websites/publish',{method:'POST',body:JSON.stringify({model:data.model})});}
    if(name==='listWebsiteVersions'){const versions=await customBackendRequest('/websites/versions');return versions.length?versions:(await httpsCallable(functions,name)({})).data;}
    if(name==='unpublishWebsite')return customBackendRequest('/websites/unpublish',{method:'POST'});
    if(name==='loadPublishedWebsite'){
      try{const result=await customBackendRequest(`/websites/public/${encodeURIComponent(data.slug)}`);return result.published?{model:result.website,storeUrl:result.business.slug}:null;}
      catch(error){if(error.status!==404)throw error;return (await httpsCallable(functions,name)(data)).data;}
    }
  }
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch(error) {
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') throw new Error('Business services are not available yet. Please try again later.');
    throw error;
  }
}
