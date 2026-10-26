import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';
import { customBackendRequest } from '../services/customBackendSession';
const functions = getFunctions(app);
const customSessionEnabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
export async function businessCall(name, data = {}) {
  if(customSessionEnabled){
    if(name==='loadWebsiteDraft'){
      const result=await customBackendRequest('/websites/draft');return result?.draft||null;
    }
    if(name==='saveWebsiteDraft')return customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});
    if(name==='publishWebsiteSnapshot'){await customBackendRequest('/websites/draft',{method:'PUT',body:JSON.stringify({model:data.model})});return customBackendRequest('/websites/publish',{method:'POST',body:JSON.stringify({model:data.model})});}
    if(name==='listWebsiteVersions')return customBackendRequest('/websites/versions');
    if(name==='unpublishWebsite')return customBackendRequest('/websites/unpublish',{method:'POST'});
    if(name==='loadPublishedWebsite'){
      try{const result=await customBackendRequest(`/websites/public/${encodeURIComponent(data.slug)}`);return result.published?{model:result.website,storeUrl:result.business.slug}:null;}
      catch(error){if(error.status===404)return null;throw error;}
    }
    if(name==='loadPublicProducts')return customBackendRequest(`/public/products/${encodeURIComponent(data.storeUrl)}`);
    if(name==='loadPublicProduct')return customBackendRequest(`/public/products/item/${encodeURIComponent(data.id)}`);
    if(name==='businessCatalog'){
      if(data.storeUrl){
        const business=await customBackendRequest(`/businesses/public/${encodeURIComponent(data.storeUrl)}`);
        return business?.settings?.catalog||business?.settings?.businessCatalog||null;
      }
      return customBackendRequest('/businesses/mine/catalog');
    }
    if(name==='saveBusinessCatalog')return customBackendRequest('/businesses/mine/catalog',{method:'PUT',body:JSON.stringify({data})});
    if(name==='businessRecords')return customBackendRequest(`/businesses/mine/records?type=${encodeURIComponent(data.type||'')}`);
    if(name==='updateBooking'||name==='updatePickupOrder')return customBackendRequest(`/businesses/mine/records/${encodeURIComponent(data.id)}?type=${name==='updateBooking'?'bookings':'pickupOrders'}`,{method:'PATCH',body:JSON.stringify({status:data.status})});
    if(name==='markNotificationRead')return customBackendRequest(`/businesses/mine/records/${encodeURIComponent(data.id)}?type=notifications`,{method:'PATCH',body:JSON.stringify({status:'read'})});
    if(name==='createOwnerBooking')return customBackendRequest('/businesses/mine/records/bookings',{method:'POST',body:JSON.stringify({data})});
    throw new Error(`The ${name} feature is not connected to the custom backend yet.`);
  }
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch(error) {
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') throw new Error('Business services are not available yet. Please try again later.');
    throw error;
  }
}
