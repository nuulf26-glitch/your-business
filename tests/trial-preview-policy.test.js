import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updatePreviewBrandName} from '../src/services/trialPreviewPolicy.js';

test('changing a preview business name updates footer headings on every page',()=>{
  const model={brandName:'Luma',pages:[
    {id:'home',sections:[{id:'footer-home',type:'footer',title:'ATELIER BOTANIQUE'},{id:'hero',type:'hero',title:'Keep this headline'}]},
    {id:'about',sections:[{id:'footer-about',type:'footer',title:'Old brand'}]},
  ]};
  const updated=updatePreviewBrandName(model,'Luma Atelier');
  assert.equal(updated.brandName,'Luma Atelier');
  assert.equal(updated.pages[0].sections[0].title,'Luma Atelier');
  assert.equal(updated.pages[0].sections[1].title,'Keep this headline');
  assert.equal(updated.pages[1].sections[0].title,'Luma Atelier');
  assert.equal(model.pages[0].sections[0].title,'ATELIER BOTANIQUE');
});
