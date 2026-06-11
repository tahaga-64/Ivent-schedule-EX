/** iOS（iPad 含む）かどうか */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** PWA としてホーム画面から起動しているか */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/** iPhone で Safari タブのままだと Web Push 不可（iOS 16.4+ は PWA のみ） */
export function needsPwaInstallForPush(): boolean {
  return isIOS() && !isStandalonePwa();
}
