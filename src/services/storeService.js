import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { customBackendRequest, isCustomBackendSessionEnabled } from "./customBackendSession";

function fromBusiness(business) {
  if (!business) return null;
  const settings = business.settings && typeof business.settings === 'object' ? business.settings : {};
  return { ...settings, id: business.id, userId: business.ownerId, storeUrl: business.slug, storeName: settings.storeName || business.name, businessName: settings.businessName || business.name, businessCategory: settings.businessCategory || business.category };
}

export async function saveStore(data) {
  if (isCustomBackendSessionEnabled()) {
    const result = await customBackendRequest('/businesses/mine', { method: 'PUT', body: JSON.stringify({ name: data.businessName || data.storeName || 'My Business', slug: data.storeUrl, category: data.businessCategory || data.businessGoal || 'general', settings: data }) });
    return fromBusiness(result);
  }
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  await setDoc(doc(db, "stores", user.uid), { ...data, userId: user.uid, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getStore() {
  if (isCustomBackendSessionEnabled()) return fromBusiness(await customBackendRequest('/businesses/mine'));
  const user = auth.currentUser;
  if (!user) return null;
  const storeSnapshot = await getDoc(doc(db, "stores", user.uid));
  return storeSnapshot.exists() ? storeSnapshot.data() : null;
}

export async function getStoreByUrl(storeUrl) {
  if (isCustomBackendSessionEnabled()) {
    try { return fromBusiness(await customBackendRequest(`/businesses/public/${encodeURIComponent(storeUrl)}`)); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  const snapshot = await getDocs(query(collection(db, "stores"), where("storeUrl", "==", storeUrl)));
  return snapshot.empty ? null : snapshot.docs[0].data();
}
