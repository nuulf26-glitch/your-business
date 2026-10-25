import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchPageSection, editorMode, publishWarnings } from '../src/editor/editorState.js';
import { validateImage, MAX_IMAGE_BYTES } from '../src/services/imagePolicy.js';
import { accessPolicy } from '../functions/accessPolicy.cjs';
import { nextRevision } from '../functions/draftPolicy.cjs';
const home = { id:'home',title:'Home',slug:'',sections:[{id:'hero',type:'hero',title:'Latest edit'}] };
const about = { id:'about',title:'About',slug:'about',sections:[{id:'photo',type:'photo',image:'old'}] };
const model = { sections:home.sections,pages:[home,about] };
test('upload completion preserves newer edits and updates its original page',()=>{
 const next=patchPageSection(model,'about','photo',section=>({...section,image:'uploaded'}));
 assert.equal(next.pages[0].sections[0].title,'Latest edit');
 assert.equal(next.pages[1].sections[0].image,'uploaded');
 assert.equal(model.pages[1].sections[0].image,'old');
});
test('upload does not resurrect deleted or locked sections',()=>{
 assert.throws(()=>patchPageSection(model,'home','deleted',section=>section));
 assert.throws(()=>patchPageSection({sections:[{id:'locked',locked:true}]},'home','locked',section=>section));
});
test('mode selection is independent of document and does not mutate it',()=>{
 const before=JSON.stringify(model); for(const value of ['simple','advanced','professional'])assert.equal(editorMode(value),value);
 assert.equal(editorMode('invalid'),'advanced');assert.equal(JSON.stringify(model),before);
});
test('publish review detects missing nested button destinations',()=>{
 const warnings=publishWarnings({sections:[{id:'group',type:'group',children:[{id:'cta',type:'button',buttonText:'Book now'}]}]});
 assert.match(warnings[0],/Book now.*destination/);
});
test('image validation rejects unsafe formats and zero or oversized files',()=>{
 assert.equal(validateImage({type:'image/jpeg',size:MAX_IMAGE_BYTES}),'jpg');
 for(const file of [{type:'image/svg+xml',size:50},{type:'image/heic',size:100},{type:'image/png',size:0},{type:'image/png',size:MAX_IMAGE_BYTES+1}])assert.throws(()=>validateImage(file));
});
const createdAt='2026-10-25T12:00:00Z',rolloutAt='2026-10-25T00:00:00Z';
test('trial is 14 server-anchored days and expires exactly at the boundary',()=>{
 const first=accessPolicy({createdAt,rolloutAt,now:Date.parse(createdAt),enforceExpiry:true});
 assert.equal(first.daysRemaining,14);assert.equal(first.trialEndsAt,'2026-11-08T12:00:00.000Z');
 const last=accessPolicy({createdAt,rolloutAt,now:Date.parse(first.trialEndsAt)-1,enforceExpiry:true});assert.equal(last.daysRemaining,1);assert.equal(last.canPublish,true);
 const expired=accessPolicy({createdAt,rolloutAt,now:Date.parse(first.trialEndsAt),enforceExpiry:true});assert.equal(expired.status,'expired');assert.equal(expired.canPublish,false);
});
test('existing users and verified paid entitlements keep access',()=>{
 assert.equal(accessPolicy({createdAt:'2025-01-01',rolloutAt,enforceExpiry:true}).status,'existing_account');
 const paid=accessPolicy({createdAt,rolloutAt,now:Date.parse('2027-01-01'),entitlement:{status:'active',lifetime:true},enforceExpiry:true});assert.equal(paid.canPublish,true);
 const unverified=accessPolicy({createdAt,rolloutAt,now:Date.parse('2027-01-01'),entitlement:{paid:true},enforceExpiry:true});assert.equal(unverified.canPublish,false);
});
test('rollout and expiry controls do not silently lock existing deployments',()=>{
 assert.equal(accessPolicy({createdAt,rolloutAt:''}).status,'setup_pending');
 assert.equal(accessPolicy({createdAt,rolloutAt,now:Date.parse('2027-01-01'),enforceExpiry:false}).canPublish,true);
});
test('trial expiry cannot be reset by repeated initialization',()=>{
 const args={createdAt,rolloutAt,now:Date.parse('2026-11-10'),enforceExpiry:true};
 assert.deepEqual(accessPolicy(args),accessPolicy(args));assert.equal(accessPolicy(args).daysRemaining,0);
});
test('draft revision rejects stale saves and publishes instead of overwriting',()=>{
 assert.equal(nextRevision(undefined,0),1);assert.equal(nextRevision(1,1),2);
 assert.throws(()=>nextRevision(2,1),/another tab/);assert.throws(()=>nextRevision(2,undefined),/Reload/);
});
