import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { customBackendRequest, isCustomBackendSessionEnabled } from "./customBackendSession";

export async function uploadProductImage(file) {
  if(isCustomBackendSessionEnabled()){
    const signed=await customBackendRequest('/uploads/presign',{method:'POST',body:JSON.stringify({contentType:file.type,fileSize:file.size})});
    const response=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':file.type},body:file});
    if(!response.ok)throw new Error('Image upload failed. Check the staging object storage CORS and credentials.');
    return signed.publicUrl;
  }
  const imageRef = ref(storage, `products/${Date.now()}-${file.name}`);

  await uploadBytes(imageRef, file);

  const imageUrl = await getDownloadURL(imageRef);

  return imageUrl;
}
