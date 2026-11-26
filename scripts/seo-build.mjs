import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {origin, pages, platform, tags} from '../src/seo/metadata.js';

export function render(html, data, live) {
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const head = tags(data, live).map(([tag,attrs,value]) => {
    const start = '<' + tag + ' data-cyb-seo ' + Object.entries(attrs).map(([k,v]) => k + '="' + escape(v) + '"').join(' ') + '>';
    return value === undefined ? start : start + (tag === 'script' ? value : escape(value)) + '</' + tag + '>';
  }).join('\n');
  return html.replace(/<!--seo-start-->[\s\S]*?<!--seo-end-->/, () => '<!--seo-start-->' + head + '<!--seo-end-->');
}
export function generate(dir, live) {
  const shell = readFileSync(join(dir,'index.html'),'utf8');
  writeFileSync(join(dir,'app-shell.html'), render(shell,null,false));
  for (const path of Object.keys(pages)) {
    const folder = join(dir,path);
    mkdirSync(folder,{recursive:true});
    writeFileSync(join(folder,'index.html'), render(shell,platform(path),live));
  }
  writeFileSync(join(dir,'sitemap.xml'), '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + (live ? Object.keys(pages).map(p => '<url><loc>'+origin+p+'</loc></url>').join('') : '') + '</urlset>');
  writeFileSync(join(dir,'robots.txt'), 'User-agent: *\n' + (live ? 'Allow: /\nSitemap: '+origin+'/sitemap.xml\n' : 'Disallow:\n'));
}
