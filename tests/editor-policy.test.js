import {test} from 'node:test';
import assert from 'node:assert/strict';
import { addWebsitePage,changePageSections,websitePages,safeHref } from '../src/editor/pages.js';
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
test('publishing catches empty and duplicate page slugs',()=>{
  const added=addWebsitePage(model,'Contact','contact');assert.throws(()=>validateWebsite(added));
  assert.throws(()=>validateWebsite({...model,pages:[{id:'a',slug:'',sections:model.sections},{id:'b',slug:'',sections:model.sections}]}));
});
test('script and protocol-relative destinations are rejected',()=>{
  assert.equal(safeHref('javascript:alert(1)'),'');assert.equal(safeHref('//attacker.test'),'');
  assert.equal(safeHref('#services'),'#services');assert.equal(safeHref('https://example.com'),'https://example.com');
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
import {groupSections,ungroupSections,mediaAssets} from '../src/editor/structure.js';
test('grouping preserves section contents and order; ungroup restores original sections',()=>{
 const sections=[{id:'a',type:'photo',image:'https://example.com/a.jpg'},{id:'b',type:'text',body:'Hello'},{id:'c',type:'text'}];
 const grouped=groupSections(sections,['a','b'],'group');assert.equal(grouped.length,2);assert.deepEqual(ungroupSections(grouped,'group'),sections);
 assert.deepEqual(mediaAssets({sections:grouped}),['https://example.com/a.jpg']);
 assert.throws(()=>groupSections([{...sections[0],locked:true},sections[1]],['a','b'],'g'));
});
import {appendCart,readCart} from '../src/services/cartPolicy.js';
test('cart quantities respect stock and merchants cannot mix',()=>{
 const product={id:'p',storeUrl:'salon',stock:3,price:10};
 const cart=appendCart([],product,2);assert.equal(appendCart(cart,product,5)[0].quantity,3);
 assert.throws(()=>appendCart(cart,{...product,id:'q',storeUrl:'other'}));
 assert.deepEqual(readCart({getItem:()=>'{bad json'}),[]);
});
