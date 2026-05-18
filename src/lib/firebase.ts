import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const viteEnv = import.meta.env as Record<string, string | undefined>;

function readEnvValue(key: string, fallback: string): string {
  const value = viteEnv[key]?.trim();
  if (!value || value.includes("YOUR_")) return fallback;
  return value;
}

const firebaseConfig = {
  apiKey:            readEnvValue("VITE_FIREBASE_API_KEY", "AIzaSyB6KpVGCcKyPb5Sb6jCdM0YILQdw_TZ6z0"),
  authDomain:        readEnvValue("VITE_FIREBASE_AUTH_DOMAIN", "ivent-schedule-ex.firebaseapp.com"),
  projectId:         readEnvValue("VITE_FIREBASE_PROJECT_ID", "ivent-schedule-ex"),
  storageBucket:     readEnvValue("VITE_FIREBASE_STORAGE_BUCKET", "ivent-schedule-ex.firebasestorage.app"),
  messagingSenderId: readEnvValue("VITE_FIREBASE_MESSAGING_SENDER_ID", "485064505718"),
  appId:             readEnvValue("VITE_FIREBASE_APP_ID", "1:485064505718:web:2cbd840e8c07172669a257"),
  measurementId:     "G-XGRDW0R02L",
};

const firestoreDatabaseId = readEnvValue("VITE_FIREBASE_DATABASE_ID", "(default)");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = isSupported().then(ok => ok ? getAnalytics(app) : null);

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
