const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
function visible(row){return row.status!=='hidden'||(row.hiddenUntil&&Number.isFinite(Date.parse(row.hiddenUntil))&&Date.parse(row.hiddenUntil)<=Date.now());}
function project(id,row){const result={id};for(const key of ['storeUrl','name','description','sellingPrice','salePrice','discountPercent','discount','status','stock','category','imageUrl','images','variants','sizes','colors','sku'])if(row[key]!==undefined)result[key]=row[key];return result;}
async function publicStore(slug){const stores=await getFirestore().collection('stores').where('storeUrl','==',slug).limit(2).get();return stores.size===1&&stores.docs[0].data().published!==false;}
exports.loadPublicProducts=onCall(async request=>{
 const slug=request.data?.storeUrl;if(!/^[a-z0-9-]{1,100}$/.test(slug||''))throw new HttpsError('invalid-argument','Invalid store address.');
 if(!await publicStore(slug))return [];
 const rows=await getFirestore().collection('products').where('storeUrl','==',slug).limit(300).get();
 return rows.docs.filter(row=>visible(row.data())).map(row=>project(row.id,row.data()));
});
exports.loadPublicProduct=onCall(async request=>{
 const id=request.data?.id;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id||''))throw new HttpsError('invalid-argument','Invalid product.');
 const snap=await getFirestore().doc(`products/${id}`).get();if(!snap.exists||!visible(snap.data())||!await publicStore(snap.data().storeUrl))return null;
 return project(id,snap.data());
});
