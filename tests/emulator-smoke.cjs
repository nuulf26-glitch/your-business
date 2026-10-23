// Run ONLY via firebase emulators:exec --project demo-getcyb --config firebase.emulator.json.
const assert=require('node:assert/strict');
const { initializeApp }=require('../functions/node_modules/firebase-admin/app');
const { getFirestore }=require('../functions/node_modules/firebase-admin/firestore');
async function main(){
 if(process.env.GCLOUD_PROJECT!=='demo-getcyb'||!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Emulator safety guard: refusing to contact production.');
 initializeApp({projectId:'demo-getcyb'});
 const database=getFirestore();
 const authHost=`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
 const register=async email=>{
  const response=await fetch(`${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'test-only-pass-123',returnSecureToken:true})});
  return response.json();
 };
 const owner=await register('owner@example.test'),other=await register('other@example.test');
 await database.doc(`businessPrivate/${owner.localId}/bookings/one`).set({name:'Private customer'});
 const path=`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-getcyb/databases/(default)/documents/businessPrivate/${owner.localId}/bookings/one`;
 assert.equal((await fetch(path,{headers:{Authorization:`Bearer ${owner.idToken}`}})).status,200);
 assert.equal((await fetch(path,{headers:{Authorization:`Bearer ${other.idToken}`}})).status,403);
 assert.equal((await fetch(path)).status,403);
 assert.equal((await fetch(path,{method:'PATCH',headers:{Authorization:`Bearer ${owner.idToken}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:'Invalid direct write'}}})})).status,403);
 console.log('PASS: owner-only private reads; cross-tenant and anonymous reads denied; direct mutations denied.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
