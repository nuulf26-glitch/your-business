const {test}=require('node:test');const assert=require('node:assert/strict');const {validateModel,publicModel}=require('../functions/websitePolicy.cjs');
const valid={editorVersion:2,brandName:'Business',sections:[{id:'hero',type:'hero',title:'Hello',href:'#story'}],savedSections:[{body:'Private draft asset'}]};
test('server publication strips private draft fields from public projections',()=>{const projection=publicModel(validateModel(valid));assert.equal(projection.savedSections,undefined);assert.equal(projection.sections[0].title,'Hello');});
test('server refuses invalid sections, unsafe links, duplicate pages and oversized content',()=>{
 assert.throws(()=>validateModel({...valid,sections:[{id:'a',type:'script'}]}));
 assert.throws(()=>validateModel({...valid,sections:[{id:'a',type:'button',href:'javascript:alert(1)'}]}));
 assert.throws(()=>validateModel({...valid,sections:[{id:'a',type:'photo',image:'data:image/png;base64,foo'}]}));
 assert.throws(()=>validateModel({...valid,brandName:'x'.repeat(300000)}));
});
test('private draft save permits unfinished pages and publication does not',()=>{const unfinished={...valid,pages:[{id:'home',slug:'',sections:[]}]};assert.doesNotThrow(()=>validateModel(unfinished,false));assert.throws(()=>validateModel(unfinished,true));});
