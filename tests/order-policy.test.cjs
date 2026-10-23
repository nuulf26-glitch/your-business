const {test}=require('node:test');const assert=require('node:assert/strict');
const {pickupOrder,orderTransition}=require('../functions/orderPolicy.cjs');
const now=Date.parse('2027-01-01T10:00:00Z'),catalog={takeawayEnabled:true,menu:[{id:'coffee',name:'Coffee',price:3.5}]};
const request={items:[{id:'coffee',quantity:2,price:0.01}],pickupAt:'2027-01-01T11:00:00Z'};
test('pickup totals are calculated in cents from merchant catalogue',()=>{const result=pickupOrder(catalog,request,now);assert.equal(result.total,700);assert.equal(result.paymentStatus,'unpaid');});
test('pickup rejects invalid quantities, unavailable items and closed ordering',()=>{
 assert.throws(()=>pickupOrder({...catalog,takeawayEnabled:false},request,now));
 assert.throws(()=>pickupOrder(catalog,{...request,items:[{id:'coffee',quantity:-2}]},now));
 assert.throws(()=>pickupOrder(catalog,{...request,items:[{id:'missing',quantity:1}]},now));
 assert.throws(()=>pickupOrder(catalog,{...request,items:[...request.items,...request.items]},now));
 assert.throws(()=>pickupOrder(catalog,{...request,pickupAt:'2027-01-01T10:01:00Z'},now));
});
test('order statuses cannot jump from new to completed or reopen cancelled orders',()=>{assert.equal(orderTransition('new','accepted'),'accepted');assert.throws(()=>orderTransition('new','completed'));assert.throws(()=>orderTransition('cancelled','preparing'));});
