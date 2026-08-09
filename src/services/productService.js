import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase";

const productsCollection = collection(db, "products");


export async function addProduct(product) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const docRef = await addDoc(productsCollection, {
  ...product,
  userId: user.uid,
  storeUrl: product.storeUrl,
});

}


export async function getProducts() {
  const user = auth.currentUser;

  if (!user) {
    return [];
  }

  const q = query(
    productsCollection,
    where("userId", "==", user.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}


export async function getProductsByStore(storeUrl) {
  const q = query(
    productsCollection,
    where("storeUrl", "==", storeUrl)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function getProductById(id) {
  const productDoc = doc(
    db,
    "products",
    id
  );

  const snapshot = await getDoc(productDoc);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function deleteProduct(id) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const productDoc = doc(db, "products", id);

  const productSnapshot = await getDoc(productDoc);

  if (productSnapshot.data()?.userId !== user.uid) {
    throw new Error(
      "You are not allowed to delete this product."
    );
  }

  await deleteDoc(productDoc);
}


export async function updateProduct(id, updatedProduct) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const productDoc = doc(db, "products", id);

  const productSnapshot = await getDoc(productDoc);

  if (productSnapshot.data()?.userId !== user.uid) {
    throw new Error(
      "You are not allowed to edit this product."
    );
  }

  await updateDoc(productDoc, updatedProduct);
}
