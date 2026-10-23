const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createHash}=require('node:crypto');
exports.recordPageView=onCall({enforceAppCheck:true},async request=>{
 const {storeUrl,sessionId,page}=request.data||{};
 if(!/^[a-z0-9-]{1,100}$/.test(storeUrl||'')||!/^[a-zA-Z0-9-]{16,100}$/.test(sessionId||'')||typeof page!=='string'||page.length>200)throw new HttpsError('invalid-argument','Invalid analytics event.');
 const db=getFirestore();const stores=await db.collection('stores').where('storeUrl','==',storeUrl).limit(2).get();
 if(stores.size!==1||stores.docs[0].data().published===false)return {recorded:false};
 const ownerId=stores.docs[0].id,config=await db.doc(`businessCatalogs/${ownerId}`).get();
 if(!config.data()?.analyticsEnabled)return {recorded:false};
 const date=new Date().toISOString().slice(0,10),key=createHash('sha256').update(`${date}:${sessionId}`).digest('hex');
 let source='direct';try{const parsed=new URL(request.data.referrer);source=parsed.hostname.slice(0,150);}catch{/* Direct visits have no referrer. */}
 const sessionRef=db.doc(`businessPrivate/${ownerId}/analyticsSessions/${date}-${key}`),statsRef=db.doc(`businessPrivate/${ownerId}/analytics/${date}`);
 await db.runTransaction(async tx=>{const session=await tx.get(sessionRef);tx.set(statsRef,{date,pageViews:FieldValue.increment(1),visits:FieldValue.increment(session.exists?0:1)},{merge:true});if(!session.exists)tx.set(sessionRef,{date,source});
  const pageKey=createHash('sha256').update(page).digest('hex');
  tx.set(db.doc(`businessPrivate/${ownerId}/analyticsPages/${pageKey}`),{page,views:FieldValue.increment(1)},{merge:true});
  if(!session.exists){const sourceKey=createHash('sha256').update(source).digest('hex');tx.set(db.doc(`businessPrivate/${ownerId}/analyticsSources/${sourceKey}`),{source,visits:FieldValue.increment(1)},{merge:true});}
 });return {recorded:true};
});
exports.businessAnalytics=onCall(async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Please sign in.');const uid=request.auth.uid,db=getFirestore();
 const [days,pages,sources]=await Promise.all([db.collection(`businessPrivate/${uid}/analytics`).orderBy('date','desc').limit(30).get(),db.collection(`businessPrivate/${uid}/analyticsPages`).orderBy('views','desc').limit(10).get(),db.collection(`businessPrivate/${uid}/analyticsSources`).orderBy('visits','desc').limit(10).get()]);
 return {days:days.docs.map(row=>row.data()),pages:pages.docs.map(row=>row.data()),sources:sources.docs.map(row=>row.data())};
});
