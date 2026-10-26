import { collection, getDocs, deleteDoc, doc, query, where, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { customBackendRequest, isCustomBackendSessionEnabled } from "./customBackendSession";
import { getStore } from "./storeService";

const customersCollection = collection(db, "customers");
const fromCustomer = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}) });

export async function addCustomer(customer) {
  if (isCustomBackendSessionEnabled()) return fromCustomer(await customBackendRequest('/customers', { method: 'POST', body: JSON.stringify({ data: customer }) }));
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  const ref = doc(customersCollection);
  await setDoc(ref, { ...customer, userId: user.uid, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function addCustomerFromCheckout(customer) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest('/public/customers', { method: 'POST', body: JSON.stringify({ customer }) });
  if (!customer.storeUrl || !customer.phone) return;
  const safeStoreUrl = customer.storeUrl.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  const safePhone = customer.phone.replace(/[^0-9]/g, "");
  await setDoc(doc(db, "customers", `${safeStoreUrl}-${safePhone}`), { ...customer, createdAt: new Date().toISOString() }, { merge: true });
}

export async function getCustomers() {
  if (isCustomBackendSessionEnabled()) return (await customBackendRequest('/customers')).map(fromCustomer);
  const user = auth.currentUser;
  if (!user) return [];
  const store = await getStore();
  if (!store?.storeUrl) return [];
  const snapshot = await getDocs(query(customersCollection, where("storeUrl", "==", store.storeUrl)));
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
}

export async function deleteCustomer(id) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!auth.currentUser) throw new Error("User not logged in");
  await deleteDoc(doc(db, "customers", id));
}

export async function updateCustomerStatus(id, status) {
  if (isCustomBackendSessionEnabled()) return fromCustomer(await customBackendRequest(`/customers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }));
  await updateDoc(doc(db, "customers", id), { status });
}
