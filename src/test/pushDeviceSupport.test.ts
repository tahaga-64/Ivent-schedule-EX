import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isIOS,
  isStandalonePwa,
  isMobileViewport,
  needsPwaInstallForPush,
} from '../lib/pushDeviceSupport';

// navigator / window のプロパティを一時上書きするヘルパ
function setNav(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36';

afterEach(() => {
  vi.unstubAllGlobals();
  // jsdom 既定値へ戻す（テスト間の汚染防止）
  setNav({ userAgent: ANDROID_UA, platform: 'Linux', maxTouchPoints: 0, standalone: undefined });
});

describe('isIOS', () => {
  it('iPhone の UA を iOS と判定する', () => {
    setNav({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 });
    expect(isIOS()).toBe(true);
  });

  it('iPadOS（MacIntel + タッチ）も iOS と判定する', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 });
    expect(isIOS()).toBe(true);
  });

  it('Android は iOS ではない', () => {
    setNav({ userAgent: ANDROID_UA, platform: 'Linux', maxTouchPoints: 1 });
    expect(isIOS()).toBe(false);
  });

  it('タッチ非対応の Mac は iOS ではない', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 });
    expect(isIOS()).toBe(false);
  });
});

describe('isStandalonePwa', () => {
  it('display-mode: standalone なら true', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(isStandalonePwa()).toBe(true);
  });

  it('navigator.standalone === true（iOS Safari PWA）なら true', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    setNav({ standalone: true });
    expect(isStandalonePwa()).toBe(true);
  });

  it('通常のブラウザタブなら false', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    setNav({ standalone: false });
    expect(isStandalonePwa()).toBe(false);
  });
});

describe('isMobileViewport', () => {
  it('幅 768 未満は true', () => {
    vi.stubGlobal('innerWidth', 375);
    expect(isMobileViewport()).toBe(true);
  });

  it('幅 768 以上は false', () => {
    vi.stubGlobal('innerWidth', 1024);
    expect(isMobileViewport()).toBe(false);
  });
});

describe('needsPwaInstallForPush', () => {
  it('iPhone + ブラウザタブ（非PWA）は PWA 追加が必要', () => {
    setNav({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, standalone: false });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(needsPwaInstallForPush()).toBe(true);
  });

  it('iPhone + PWA 起動なら不要', () => {
    setNav({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, standalone: true });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(needsPwaInstallForPush()).toBe(false);
  });

  it('Android は（タブでも）不要', () => {
    setNav({ userAgent: ANDROID_UA, platform: 'Linux', maxTouchPoints: 1, standalone: false });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(needsPwaInstallForPush()).toBe(false);
  });
});
