/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_DATABASE_ID: string;
  /** Web Push（FCM）用の公開 VAPID キー。未設定でもアプリ内通知は動作する */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** Cloudflare Push Worker のURL（例: https://ivent-schedule-push.<account>.workers.dev）。未設定ならベルは非表示 */
  readonly VITE_PUSH_WORKER_URL?: string;
  /** Web Push の公開鍵（VAPID public key）。Worker の WEB_PUSH_PUBLIC_KEY と同じ値 */
  readonly VITE_WEB_PUSH_PUBLIC_KEY?: string;
  readonly GEMINI_API_KEY: string;
  /** スケジュールアプリ（外部Firebaseプロジェクト）接続用 */
  readonly VITE_EX_SCHEDULE_API_KEY: string;
  readonly VITE_EX_SCHEDULE_PROJECT_ID: string;
  readonly VITE_EX_SCHEDULE_DATABASE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
