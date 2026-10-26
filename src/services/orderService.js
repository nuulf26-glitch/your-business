import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getStore } from "./storeService";
import { customBackendRequest, isCustomBackendSessionEnabled } from "./customBackendSession";

const ordersCollection = collection(db, "orders");
const displayStatus = (value) => String(value || '').replace(/^./, (letter) => letter.toUpperCase());
const fromOrder = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}), status: displayStatus(row.status || row.data?.status), createdAt: row.createdAt || row.data?.createdAt });

export async function addOrder(order) {
  if (isCustomBackendSessionEnabled()) return fromOrder(await customBackendRequest('/orders', { method: 'POST', body: JSON.stringify({ data: order }) }));
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  const ref = await addDoc(ordersCollection, { ...order, userId: user.uid, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function getOrders() {
  if (isCustomBackendSessionEnabled()) return (await customBackendRequest('/orders')).map(fromOrder);
  const user = auth.currentUser;
  if (!user) return [];
  const store = await getStore();
  if (!store?.storeUrl) return [];
  const snapshot = await getDocs(query(ordersCollection, where("storeUrl", "==", store.storeUrl)));
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
}

export async function updateOrderStatus(id, status) {
  if (isCustomBackendSessionEnabled()) return fromOrder(await customBackendRequest(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: String(status).toLowerCase() }) }));
  await updateDoc(doc(db, "orders", id), { status });
}

export async function deleteOrder(id) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await deleteDoc(doc(db, "orders", id));
}
