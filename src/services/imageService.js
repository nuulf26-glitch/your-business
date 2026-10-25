import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';
import { validateImage, imageError } from './imagePolicy';
export async function uploadProductImage(file, onProgress = () => {}) {
  const extension = validateImage(file);
  const owner = auth.currentUser;
  if (!owner) throw new Error('Please sign in again before uploading an image.');
  const imageRef = ref(storage, `businesses/${owner.uid}/media/${crypto.randomUUID()}.${extension}`);
  const task = uploadBytesResumable(imageRef, file, { contentType: file.type });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => task.cancel(), 90000);
      task.on('state_changed', snapshot => onProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)),
        error => { clearTimeout(timeout); reject(error); }, () => { clearTimeout(timeout); resolve(); });
    });
    if (auth.currentUser?.uid !== owner.uid) throw new Error('Your session changed. Sign in to the original account and retry.');
    return await getDownloadURL(imageRef);
  } catch (error) { throw new Error(imageError(error)); }
}
