import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'ivent:chunk-reload';

/** Vite の code-split チャンク読み込み失敗（デプロイ後の古いハッシュ参照など） */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('importing a module script failed') ||
    (msg.includes('failed to fetch') && msg.includes('.js'))
  );
}

/** 1セッションにつき1回だけ自動リロードして最新バンドルを取得 */
export function reloadOnceForChunkError(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    // sessionStorage 不可時もリロードは試みる
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignore
  }
}

/** 画面遷移時の lazy import にリトライ＋自動リロードを付与 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error) && reloadOnceForChunkError()) {
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }),
  );
}

/** 起動時に未処理のチャンク読み込み失敗を捕捉 */
export function registerChunkLoadRecovery(): void {
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      reloadOnceForChunkError();
    }
  };
  window.addEventListener('unhandledrejection', onRejection);
}
