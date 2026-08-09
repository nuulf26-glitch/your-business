import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { getStore } from "./storeService";

const ordersCollection = collection(db, "orders");

export async function addOrder(order) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  await addDoc(ordersCollection, {
    ...order,
    userId: user.uid,
    createdAt: new Date().toISOString(),
  });
}

export async function getOrders() {
  const user = auth.currentUser;

  if (!user) {
    return [];
  }

  const store = await getStore();

  if (!store || !store.storeUrl) {
    return [];
  }

  const ordersQuery = query(
    ordersCollection,
    where("storeUrl", "==", store.storeUrl)
  );

  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs.map((orderDocument) => ({
    id: orderDocument.id,
    ...orderDocument.data(),
  }));
}

export async function updateOrderStatus(id, status) {
  const orderDocument = doc(db, "orders", id);

  await updateDoc(orderDocument, {
    status,
  });
}

export async function deleteOrder(id) {
  const orderDocument = doc(db, "orders", id);

  await deleteDoc(orderDocument);
}