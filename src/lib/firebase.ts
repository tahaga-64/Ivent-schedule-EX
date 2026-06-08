import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithEmailAndPassword, Auth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, Firestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const viteEnv = import.meta.env as Record<string, string | undefined>;

function readEnvValue(key: string): string {
  const value = viteEnv[key]?.trim();
  if (!value || value.includes("YOUR_")) {
    return "";
  }
  return value;
}

const firebaseConfig = {
  apiKey:            readEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain:        readEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId:         readEnvValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket:     readEnvValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnvValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId:             readEnvValue("VITE_FIREBASE_APP_ID"),
  measurementId:     readEnvValue("VITE_FIREBASE_MEASUREMENT_ID"),
};

const firestoreDatabaseId = readEnvValue("VITE_FIREBASE_DATABASE_ID") || "(default)";

// Firebase の設定が揃っているか確認
const missingKeys = (
  ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'] as const
).filter(k => !readEnvValue(k));

let _configError: string | null = missingKeys.length > 0
  ? `Firebase環境変数が未設定です: ${missingKeys.join(', ')}\nVercelのEnvironment Variablesに追加してください。`
  : null;

// 定義前使用エラーを避けるため確定割り当てアサーションを使用
let app!: FirebaseApp;
let db!: Firestore;
let auth!: Auth;

if (!_configError) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firestoreDatabaseId);
    auth = getAuth(app);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    _configError = `Firebase初期化エラー: ${msg}`;
    console.error('Firebase initialization failed:', msg);
  }
}

export const firebaseConfigError: string | null = _configError;

export { app, db, auth };
export const analytics = !firebaseConfigError
  ? isSupported().then(ok => ok ? getAnalytics(app) : null)
  : Promise.resolve(null);

const googleProvider = new GoogleAuthProvider();

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
appleProvider.setCustomParameters({ locale: 'ja' });

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithApple = () => signInWithPopup(auth, appleProvider);
export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => auth.signOut();

// Connection test (only when configured)
if (!firebaseConfigError) {
  (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  })();
}

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
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
