const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {validateModel,publicModel}=require('./websitePolicy.cjs');
const {nextRevision}=require('./draftPolicy.cjs');
const {requirePublishAccess}=require('./access.cjs');
function revision(stored,expected){try{return nextRevision(stored,expected);}catch(error){throw new HttpsError('aborted',error.message);}}
function owner(request){if(!request.auth)throw new HttpsError('unauthenticated','Please sign in.');return request.auth.uid;}
function validated(data,publishing){try{return validateModel(data,publishing);}catch(error){throw new HttpsError('invalid-argument',error.message);}}
exports.loadWebsiteDraft=onCall(async request=>{
 const uid=owner(request),db=getFirestore();
 const draft=await db.doc(`businessPrivate/${uid}/website/draft`).get();
 if(draft.exists)return draft.data().model;
 const store=await db.doc(`stores/${uid}`).get();const data=store.data();
 return data?.draftEditorData||data?.editorData||null;
});
exports.loadWebsiteWorkspace=onCall(async request=>{
 const uid=owner(request),db=getFirestore();
 const draft=await db.doc(`businessPrivate/${uid}/website/draft`).get();
 if(draft.exists)return {model:draft.data().model,revision:draft.data().revision||0};
 const store=await db.doc(`stores/${uid}`).get();
 return {model:store.data()?.draftEditorData||store.data()?.editorData||null,revision:0};
});
exports.saveWebsiteDraft=onCall(async request=>{
 const uid=owner(request),model=validated(request.data?.model,false),db=getFirestore();
 const ref=db.doc(`businessPrivate/${uid}/website/draft`);
 return db.runTransaction(async tx=>{
  const current=await tx.get(ref),next=revision(current.data()?.revision,request.data?.expectedRevision);
  tx.set(ref,{model,revision:next,updatedAt:FieldValue.serverTimestamp()});
  return {saved:true,revision:next};
 });
});
exports.publishWebsiteSnapshot=onCall(async request=>{
 const uid=owner(request),model=validated(request.data?.model,true),db=getFirestore();
 await requirePublishAccess(uid);
 const snapshot=publicModel(model),storeRef=db.doc(`stores/${uid}`),version=db.collection(`businessPrivate/${uid}/versions`).doc();
 return db.runTransaction(async tx=>{
  const draftRef=db.doc(`businessPrivate/${uid}/website/draft`);
  const draft=await tx.get(draftRef),next=revision(draft.data()?.revision,request.data?.expectedRevision);
  const store=await tx.get(storeRef);const slug=store.data()?.storeUrl;
  if(!/^[a-z0-9-]{1,100}$/.test(slug||''))throw new HttpsError('failed-precondition','Choose a valid store address in Store Setup.');
  const publicRef=db.doc(`publishedWebsites/${slug}`);const existing=await tx.get(publicRef);
  if(existing.exists&&existing.data().ownerId!==uid)throw new HttpsError('already-exists','This website address is already in use.');
  const duplicates=await tx.get(db.collection('stores').where('storeUrl','==',slug).limit(2));
  if(duplicates.docs.some(item=>item.id!==uid))throw new HttpsError('already-exists','This website address is already in use.');
  const previous=store.data()?.publishedSlug;
  const previousRef=previous&&previous!==slug&&/^[a-z0-9-]{1,100}$/.test(previous)?db.doc(`publishedWebsites/${previous}`):null;
  const previousSnapshot=previousRef?await tx.get(previousRef):null;
  const publishedAt=new Date().toISOString();
  tx.set(publicRef,{ownerId:uid,model:snapshot,published:true,publishedAt});
  // Previous public address must stop serving an outdated projection when the slug changes.
  if(previousRef&&previousSnapshot?.data()?.ownerId===uid)tx.set(previousRef,{published:false},{merge:true});
  tx.set(version,{model:snapshot,publishedAt});
  tx.set(draftRef,{model,revision:next,updatedAt:FieldValue.serverTimestamp()});
  tx.set(storeRef,{published:true,publishedSlug:slug,publishedAt},{merge:true});
  return {slug,versionId:version.id,revision:next};
 });
});
exports.loadPublishedWebsite=onCall(async request=>{
 const slug=request.data?.slug;if(!/^[a-z0-9-]{1,100}$/.test(slug||''))throw new HttpsError('invalid-argument','Invalid address.');
 const db=getFirestore(),projection=await db.doc(`publishedWebsites/${slug}`).get();
 if(projection.exists)return projection.data().published?{model:projection.data().model,storeUrl:slug}:null;
 const matches=await db.collection('stores').where('storeUrl','==',slug).limit(2).get();
 if(matches.size!==1)return null;
 const store=matches.docs[0].data();if(store.published===false)return null;
 return {storeUrl:slug,model:publicModel(store.publishedEditorData||store.editorData||store)};
});
exports.unpublishWebsite=onCall(async request=>{
 const uid=owner(request),db=getFirestore(),ref=db.doc(`stores/${uid}`);
 await db.runTransaction(async tx=>{
    const store=await tx.get(ref);const slug=store.data()?.publishedSlug||store.data()?.storeUrl;
    const publicRef=/^[a-z0-9-]{1,100}$/.test(slug||'')?db.doc(`publishedWebsites/${slug}`):null;
    const existing=publicRef?await tx.get(publicRef):null;
    tx.set(ref,{published:false},{merge:true});
    if(publicRef&&existing?.data()?.ownerId===uid)tx.set(publicRef,{published:false},{merge:true});
  });return {success:true};
});
exports.listWebsiteVersions=onCall(async request=>{
 const uid=owner(request);const versions=await getFirestore().collection(`businessPrivate/${uid}/versions`).orderBy('publishedAt','desc').limit(10).get();
 return versions.docs.map(row=>({id:row.id,...row.data()}));
});
