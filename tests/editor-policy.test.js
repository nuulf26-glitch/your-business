import {test} from 'node:test';
import assert from 'node:assert/strict';
import { addWebsitePage,changePageSections,websitePages,safeHref,duplicateWebsitePage,setHomepage,deleteWebsitePage,websiteNavigation,setNavigationItem,addExternalNavigation,addPageNavigation,reorderNavigation,removeNavigation } from '../src/editor/pages.js';
import { mediaStyle } from '../src/media/media.js';
import { sectionStyle } from '../src/editor/sectionStyle.js';
import { validateWebsite } from '../src/editor/publishing.js';
import { publicProduct, productPrice } from '../src/services/productPolicy.js';
import { orderMetrics } from '../src/business/metrics.js';
const model={brandName:'Test',sections:[{id:'hero',type:'hero'}]};
test('editing another page never overwrites home sections',()=>{
  const added=addWebsitePage(model,'About Us','about');
  const changed=changePageSections(added,'about',[{id:'about-text',type:'text'}]);
  assert.deepEqual(changed.sections,model.sections);
  assert.equal(websitePages(changed)[1].sections[0].id,'about-text');
  assert.throws(()=>addWebsitePage(changed,'About Us','other'));
  assert.doesNotThrow(()=>validateWebsite(changed));
});
test('duplicate page copies the document with new section IDs and a unique address',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Welcome'}]},{id:'about',slug:'about',title:'About',sections:[{id:'about-text',type:'text',body:'Story'}]}]};
  let id=0;
  const copy=duplicateWebsitePage(base,'about',prefix=>`${prefix}-${++id}`);
  assert.equal(copy.pages[2].title,'About copy');
  assert.equal(copy.pages[2].slug,'about-copy');
  assert.notEqual(copy.pages[2].sections[0].id,'about-text');
  assert.equal(base.pages.length,2);
  assert.doesNotThrow(()=>validateWebsite(copy));
});
test('promoting a page keeps exactly one root page and does not mutate the original',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero'}]},{id:'about',slug:'about',title:'About',sections:[{id:'about-text',type:'text'}]}]};
  const promoted=setHomepage(base,'about');
  assert.equal(promoted.pages[0].id,'about');
  assert.equal(promoted.pages[0].slug,'');
  assert.equal(promoted.pages[1].id,'home');
  assert.equal(promoted.pages[1].slug,'home');
  assert.equal(base.pages[0].slug,'');
  assert.doesNotThrow(()=>validateWebsite(promoted));
});
test('deleting a page preserves the homepage and remaining page sections',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero'}]},{id:'about',slug:'about',title:'About',sections:[{id:'about-text',type:'text'}]}]};
  assert.throws(()=>deleteWebsitePage(base,'home'),/homepage/);
  const next=deleteWebsitePage(base,'about');
  assert.equal(next.pages.length,1);
  assert.equal(next.sections[0].id,'hero');
  assert.throws(()=>deleteWebsitePage(next,'home'),/at least one page/);
});
test('publishing catches empty and duplicate page slugs',()=>{
  const added=addWebsitePage(model,'Contact','contact');assert.throws(()=>validateWebsite(added));
  assert.throws(()=>validateWebsite({...model,pages:[{id:'a',slug:'',sections:model.sections},{id:'b',slug:'',sections:model.sections}]}));
});
test('script and protocol-relative destinations are rejected',()=>{
  assert.equal(safeHref('javascript:alert(1)'),'');assert.equal(safeHref('//attacker.test'),'');
  assert.equal(safeHref('#services'),'#services');assert.equal(safeHref('https://example.com'),'https://example.com');
});
test('custom menu labels follow page IDs through rename and deleted links are removed',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:model.sections},{id:'about',slug:'about',title:'About',sections:model.sections}],navigation:[{id:'n1',type:'page',pageId:'about',label:''}]};
  const renamed={...base,pages:base.pages.map(page=>page.id==='about'?{...page,title:'Our Story',slug:'our-story'}:page)};
  assert.equal(websiteNavigation(renamed)[0].pageId,'about');
  assert.equal(websiteNavigation(renamed)[0].label,'');
  const deleted=deleteWebsitePage(renamed,'about');
  assert.equal(websiteNavigation(deleted).length,0);
});
test('external navigation validates URLs, supports custom labels and reorder/removal',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:model.sections}]};
  const withLink=addExternalNavigation(base,'Instagram','https://instagram.com/cyb','social');
  assert.equal(websiteNavigation(withLink).find(item=>item.type==='external').label,'Instagram');
  assert.throws(()=>addExternalNavigation(base,'Bad','javascript:alert(1)'),/valid external/);
  assert.throws(()=>addExternalNavigation(base,'','https://example.com'),/menu label/);
  const two=addExternalNavigation(withLink,'Store','https://shop.example.com','store');
  assert.equal(reorderNavigation(two,2,-1).navigation.at(-2).id,'store');
  assert.equal(removeNavigation(two,1).navigation.length,2);
  assert.throws(()=>setNavigationItem(withLink,1,{href:'//bad.test'}),/valid external/);
});
test('new pages can be explicitly added to an existing navigation menu',()=>{
  const base={...model,pages:[{id:'home',slug:'',title:'Home',sections:model.sections},{id:'contact',slug:'contact',title:'Contact',sections:model.sections}],navigation:[{id:'page:home',type:'page',pageId:'home',label:''}]};
  const next=addPageNavigation(base,'contact');assert.equal(websiteNavigation(next).at(-1).pageId,'contact');
  assert.throws(()=>addPageNavigation(next,'missing'),/existing page/);assert.throws(()=>addPageNavigation(next,'contact'),/already in the menu/);
});
test('image crop metadata is bounded and projected into the live media preview style',()=>{
  const crop=mediaStyle({width:100,unit:'%',aspectRatio:'4 / 3',focalX:35,focalY:70,cropScale:1.8});
  assert.equal(crop['--media-ratio'],'4 / 3');assert.equal(crop['--media-position'],'35% 70%');assert.equal(crop['--media-crop-scale'],1.8);
  assert.equal(mediaStyle({cropScale:9})['--media-crop-scale'],2.5);
});
test('advanced and responsive styles render with safe bounds in published preview',()=>{
  const output=sectionStyle({style:{fontSize:64,paddingX:20,borderWidth:2,borderColor:'#123456',borderRadius:12,shadow:'soft',fontWeight:700},responsive:{phone:{fontSize:30,paddingY:12,hidden:true}}},'phone');
  assert.equal(output['--cyb-heading-size'],'30px');assert.equal(output.paddingInline,'20px');assert.equal(output.paddingBlock,'12px');assert.equal(output.border,'2px solid #123456');assert.equal(output.display,'none');
  const bounded=sectionStyle({style:{fontSize:999,paddingY:999,borderRadius:999}},'laptop');assert.equal(bounded['--cyb-heading-size'],'120px');assert.equal(bounded.paddingBlock,'500px');assert.equal(bounded.borderRadius,'200px');
});
test('hidden products and expired hidden windows',()=>{
  assert.equal(publicProduct({status:'hidden'}),false);
  assert.equal(publicProduct({status:'hidden',hiddenUntil:'2020-01-01'}),true);
  assert.equal(publicProduct({status:'active'}),true);
});
test('explicit sale price, percentage and zero are supported',()=>{
  assert.equal(productPrice({sellingPrice:100,status:'onSale',salePrice:0}),0);
  assert.equal(productPrice({sellingPrice:100,status:'onSale',salePrice:'',discountPercent:20}),80);
});
test('revenue does not become profit when costs are missing',()=>{
  const metric=orderMetrics([{status:'paid',total:100},{status:'cancelled',total:999}]);
  assert.equal(metric.revenue,100);assert.equal(metric.profit,null);
  const complete=orderMetrics([{status:'paid',total:100,costOfGoods:40,expenses:10}]);
  assert.equal(complete.profit,50);assert.equal(complete.margin,50);
});
import { DESIGN_COLLECTIONS, collectionWebsite } from '../src/editor/collections.js';
test('every design collection creates four valid pages with unique section IDs',()=>{
 let count=0;
 for(const collection of DESIGN_COLLECTIONS){
  const template=collectionWebsite(collection,type=>({id:`test-${++count}`,type,items:[],style:{}}));
  assert.equal(template.pages.length,4);
  assert.doesNotThrow(()=>validateWebsite(template));
 }
});
import {groupSections,ungroupSections,mediaAssets,findSection,updateNestedSection,reorderNestedSection,removeNestedSection,insertAfterSection} from '../src/editor/structure.js';
test('grouping preserves section contents and order; ungroup restores original sections',()=>{
 const sections=[{id:'a',type:'photo',image:'https://example.com/a.jpg'},{id:'b',type:'text',body:'Hello'},{id:'c',type:'text'}];
 const grouped=groupSections(sections,['a','b'],'group');assert.equal(grouped.length,2);assert.deepEqual(ungroupSections(grouped,'group'),sections);
 assert.deepEqual(mediaAssets({sections:grouped}),['https://example.com/a.jpg']);
 assert.throws(()=>groupSections([{...sections[0],locked:true},sections[1]],['a','b'],'g'));
});
test('nested sections can be found, edited, duplicated, reordered, and removed safely',()=>{
 const sections=[{id:'group',type:'group',children:[{id:'a',type:'text',body:'A'},{id:'b',type:'heading',title:'B'}]}];
 assert.equal(findSection(sections,'b').title,'B');
 const edited=updateNestedSection(sections,'a',item=>({...item,body:'Updated'}));
 assert.equal(findSection(edited,'a').body,'Updated');
 assert.equal(findSection(sections,'a').body,'A');
 const duplicated=insertAfterSection(edited,'a',{id:'copy',type:'text'});
 assert.deepEqual(findSection(duplicated,'group').children.map(item=>item.id),['a','copy','b']);
 const reordered=reorderNestedSection(duplicated,'b','a','before');
 assert.deepEqual(findSection(reordered,'group').children.map(item=>item.id),['b','a','copy']);
 assert.deepEqual(findSection(removeNestedSection(reordered,'a'),'group').children.map(item=>item.id),['b','copy']);
 assert.equal(reorderNestedSection(reordered,'a','group','after'),reordered,'cross-level moves are rejected');
});
import {appendCart,readCart} from '../src/services/cartPolicy.js';
test('cart quantities respect stock and merchants cannot mix',()=>{
 const product={id:'p',storeUrl:'salon',stock:3,price:10};
 const cart=appendCart([],product,2);assert.equal(appendCart(cart,product,5)[0].quantity,3);
 assert.throws(()=>appendCart(cart,{...product,id:'q',storeUrl:'other'}));
 assert.deepEqual(readCart({getItem:()=>'{bad json'}),[]);
});
