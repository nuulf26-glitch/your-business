import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
export async function businessCall(name, data = {}) {
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch(error) {
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') throw new Error('Business services are not available yet. Please try again later.');
    throw error;
  }
}
