import { customBackendRequest, getActiveBusinessId } from './customBackendSession';
const query=(params={})=>new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString();
export const getAnalytics=(range={})=>customBackendRequest(`/analytics/overview?${query(range)}`);
export const getSavedReports=()=>customBackendRequest('/analytics/reports');
export const saveReport=data=>customBackendRequest('/analytics/reports',{method:'POST',body:JSON.stringify({data})});
export const deleteReport=id=>customBackendRequest(`/analytics/reports/${encodeURIComponent(id)}`,{method:'DELETE'});
export async function downloadAnalyticsCsv(range={}){const base=(import.meta.env?.VITE_CUSTOM_BACKEND_URL||'').replace(/\/$/,'');const response=await fetch(`${base}/api/v1/analytics/export.csv?${query(range)}`,{credentials:'include',headers:getActiveBusinessId()?{'x-cyb-business-id':getActiveBusinessId()}: {}});if(!response.ok)throw new Error('The report could not be exported.');const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cyb-analytics-report.csv';link.click();URL.revokeObjectURL(url);}
