import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export async function uploadProductImage(file) {
  const imageRef = ref(storage, `products/${Date.now()}-${file.name}`);

  await uploadBytes(imageRef, file);

  const imageUrl = await getDownloadURL(imageRef);

  return imageUrl;
}