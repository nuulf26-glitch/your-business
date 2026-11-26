import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generate,render} from '../scripts/seo-build.mjs';
import {pages,platform} from '../src/seo/metadata.js';
import {lookup} from '../netlify/functions/store-seo.mjs';
const shell = readFileSync(new URL('../index.html',import.meta.url),'utf8');
for (const live of [true,false]) test('built pages and discovery files, production='+live, t => {
  const dir = mkdtempSync(join(tmpdir(),'cyb-seo-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'index.html'),shell);
  generate(dir,live);
  const read = name => readFileSync(join(dir,name),'utf8');
  const sitemap = read('sitemap.xml');
  for (const path of Object.keys(pages)) {
    const html = read(join(path,'index.html'));
    assert.ok(html.includes(platform(path).title));
    assert.ok(html.includes('href="'+platform(path).url+'"'));
    assert.ok(html.includes('property="og:url"'));
    assert.ok(html.includes('application/ld+json'));
    assert.equal(html.includes('content="noindex, follow"'),!live);
    assert.equal(sitemap.includes('<loc>'+platform(path).url+'</loc>'),live);
  }
  assert.match(read('app-shell.html'),/noindex/);
  assert.doesNotMatch(sitemap,/dashboard|login|editor/);
  assert.equal(read('robots.txt').includes('Sitemap:'),live);
});
test('published snapshot controls metadata and escapes merchant input', async () => {
  const result = await lookup('/store/demo/about/',async p => {
    assert.equal(p,'/websites/public/demo');
    return {published:true,business:{slug:'demo'},website:{pages:[{slug:'about',seoTitle:'</title><script>x</script>',description:'A & B',socialImage:'https://example.com/a.jpg'}]}};
  });
  const html = render(shell,result.data,true);
  assert.match(html,/&lt;\/title&gt;/);
  assert.doesNotMatch(html,/<script>x/);
  assert.match(html,/getcyb.fit\/store\/demo\/about"/);
  assert.match(html,/og:image/);
  assert.equal((await lookup('/store/demo',async () => ({published:false}))).status,404);
});
test('published CMS entries have article metadata and missing entries are excluded', async () => {
  const get = async () => ({collection:{name:'Journal'},entries:[{slug:'first',title:'First story',content:{summary:'An introduction'}}]});
  assert.equal((await lookup('/store/demo/content/blog/first', get)).data.type,'Article');
  assert.equal((await lookup('/store/demo/content/blog', get)).data.title,'Journal');
  assert.equal((await lookup('/store/demo/content/blog/missing', get)).status,404);
  assert.equal((await lookup('/store/demo/content/blog/first/duplicate', get)).status,404);
  assert.equal((await lookup('/store/demo/cart', get)).data,undefined);
});
