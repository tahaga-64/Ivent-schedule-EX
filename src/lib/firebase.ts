import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, writeBatch, collection, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAnalytics, logEvent } from "firebase/analytics";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Analytics if measurementId is provided
export const analytics = firebaseConfig.measurementId ? getAnalytics(app) : null;

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => auth.signOut();

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Batch operation helpers
export async function batchWrite<T extends { id: string }>(
  collectionPath: string,
  items: T[],
  operation: 'set' | 'update' | 'delete' = 'set'
) {
  const BATCH_SIZE = 500; // Firestore batch limit
  const chunks = [];
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  const promises = chunks.map(async (chunk) => {
    const batch = writeBatch(db);
    
    chunk.forEach((item) => {
      const docRef = doc(db, collectionPath, item.id);
      if (operation === 'delete') {
        batch.delete(docRef);
      } else if (operation === 'update') {
        batch.update(docRef, item as any);
      } else {
        batch.set(docRef, item);
      }
    });

    return batch.commit();
  });

  return Promise.all(promises);
}

// Photo storage helpers
export async function uploadEventPhoto(
  eventId: string,
  file: File,
  photoId: string
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `events/${eventId}/photos/${photoId}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, storagePath };
}

export async function deleteEventPhoto(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

// Analytics helpers
export function logAnalyticsEvent(eventName: string, parameters?: Record<string, any>) {
  if (analytics) {
    logEvent(analytics, eventName, parameters);
  }
}
