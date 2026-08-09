import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { getStore } from "./storeService";

const customersCollection = collection(db, "customers");

export async function addCustomer(customer) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const customerReference = doc(customersCollection);

  await setDoc(customerReference, {
    ...customer,
    userId: user.uid,
    createdAt: new Date().toISOString(),
  });
}

export async function addCustomerFromCheckout(customer) {
  if (!customer.storeUrl || !customer.phone) {
    return;
  }

  const safeStoreUrl = customer.storeUrl
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  const safePhone = customer.phone.replace(/[^0-9]/g, "");

  const customerId = `${safeStoreUrl}-${safePhone}`;
  const customerReference = doc(db, "customers", customerId);

  await setDoc(
    customerReference,
    {
      ...customer,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getCustomers() {
  const user = auth.currentUser;

  if (!user) {
    return [];
  }

  const store = await getStore();

  if (!store?.storeUrl) {
    return [];
  }

  const customersQuery = query(
    customersCollection,
    where("storeUrl", "==", store.storeUrl)
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map((customerDocument) => ({
    id: customerDocument.id,
    ...customerDocument.data(),
  }));
}

export async function deleteCustomer(id) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const customerDocument = doc(db, "customers", id);
  await deleteDoc(customerDocument);
}