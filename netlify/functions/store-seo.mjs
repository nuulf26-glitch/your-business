import {readFile} from 'node:fs/promises';
import process from 'node:process';
import {render} from '../../scripts/seo-build.mjs';
import {origin,customerPage} from '../../src/seo/metadata.js';
import {websitePages} from '../../src/editor/pages.js';

export const config = {path:'/store/*', preferStatic:true};

export async function lookup(path, get) {
  const [,prefix,store,...parts] = path.replace(/\/+$/,'').split('/');
  if (prefix !== 'store' || !store || parts[0] === 'cart') return {status:200};
  if (![store,...parts].every(s => /^[\w%-]+$/.test(s) && !/%(?:2e|2f|5c|25)/i.test(s))) return {status:404};
  if (parts[0] === 'content' && parts.length >= 2) {
    const [,collection,entry] = parts;
    if (parts.length > 3) return {status:404};
    const result = await get('/public/cms/'+store+'/'+collection+(entry ? '?entry='+entry : ''));
    const selected = entry && result.entries?.find(e => e.slug === decodeURIComponent(entry));
    if (!result.collection || (entry && !selected)) return {status:404};
    return {status:200,data:{title:selected?.title || result.collection.name, description:selected?.content?.summary || result.collection.description, url:origin+path.replace(/\/+$/,''),type:selected ? 'Article' : 'CollectionPage'}};
  }
  if (parts.length > 1) return {status:404};
  const result = await get('/websites/public/'+store);
  if (!result.published || !result.website) return {status:404};
  const page = websitePages(result.website).find(p => p.slug === decodeURIComponent(parts[0] || ''));
  if (!page) return {status:404};
  return {status:200,data:customerPage(result.website,page,'/store/'+encodeURIComponent(result.business.slug)+(page.slug ? '/'+encodeURIComponent(page.slug) : ''))};
}
export default async function handler(request) {
  const url = new URL(request.url);
  const live = url.origin === origin;
  const html = await readFile('dist/app-shell.html','utf8');
  let result = {status:200};
  if (live) {
    try {
      result = await lookup(url.pathname, async path => {
        const base = process.env.VITE_CUSTOM_BACKEND_URL || origin;
        const response = await fetch(new URL('/api/v1'+path,base), {signal:AbortSignal.timeout(5000)});
        if (!response.ok) throw Object.assign(new Error(),{status:response.status});
        return response.json();
      });
    } catch (e) { result = {status:e.status === 404 ? 404 : 503}; }
  }
  return new Response(render(html,result.data,live), {status:result.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
