import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { customBackendRequest } from "./customBackendSession";

const customSessionEnabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
async function syncBusiness(data) {
  if(!customSessionEnabled||!data?.storeUrl)return;
  await customBackendRequest('/businesses/mine',{method:'PUT',body:JSON.stringify({name:data.businessName||data.storeName||'My Business',slug:data.storeUrl,category:data.businessCategory||data.businessGoal||'general',settings:data})});
}

export async function saveStore(data) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const storeRef = doc(db, "stores", user.uid);

  await setDoc(storeRef, {
    ...data,
    userId: user.uid,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  await syncBusiness(data);
}

export async function getStore() {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const storeRef = doc(db, "stores", user.uid);
  const storeSnapshot = await getDoc(storeRef);

  if (!storeSnapshot.exists()) {
    return null;
  }

  const data=storeSnapshot.data();
  await syncBusiness(data);
  return data;
}

export async function getStoreByUrl(storeUrl) {
  const storesRef = collection(db, "stores");

  const q = query(
    storesRef,
    where("storeUrl", "==", storeUrl)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data();
}
