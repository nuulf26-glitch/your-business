import { businessCall } from "../business/api";
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { customBackendRequest, isCustomBackendSessionEnabled } from "./customBackendSession";

const productsCollection = collection(db, "products");
const fromProduct = (row) => ({ id: row.id, ...(row.data && typeof row.data === 'object' ? row.data : {}), name: row.name || row.data?.name });

export async function addProduct(product) {
  if (isCustomBackendSessionEnabled()) return fromProduct(await customBackendRequest('/products', { method: 'POST', body: JSON.stringify({ data: product }) }));
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  const row = await addDoc(productsCollection, { ...product, userId: user.uid, storeUrl: product.storeUrl });
  return row.id;
}

export async function getProducts() {
  if (isCustomBackendSessionEnabled()) return (await customBackendRequest('/products')).map(fromProduct);
  const user = auth.currentUser;
  if (!user) return [];
  const snapshot = await getDocs(query(productsCollection, where("userId", "==", user.uid)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getProductsByStore(storeUrl) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest(`/public/products/${encodeURIComponent(storeUrl)}`);
  return businessCall('loadPublicProducts', { storeUrl });
}
export async function getProductById(id) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest(`/public/products/item/${encodeURIComponent(id)}`);
  return businessCall('loadPublicProduct', { id });
}

export async function deleteProduct(id) {
  if (isCustomBackendSessionEnabled()) return customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  const productDoc = doc(db, "products", id), snapshot = await getDoc(productDoc);
  if (snapshot.data()?.userId !== user.uid) throw new Error("You are not allowed to delete this product.");
  await deleteDoc(productDoc);
}

export async function updateProduct(id, updatedProduct) {
  if (isCustomBackendSessionEnabled()) return fromProduct(await customBackendRequest(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ data: updatedProduct }) }));
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  const productDoc = doc(db, "products", id), snapshot = await getDoc(productDoc);
  if (snapshot.data()?.userId !== user.uid) throw new Error("You are not allowed to edit this product.");
  await updateDoc(productDoc, updatedProduct);
}
