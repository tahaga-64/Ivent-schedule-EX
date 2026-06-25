import { Page } from '@playwright/test';

/** Wait for the app to finish loading (past the 2.4s splash). Returns app state. */
export async function waitForAppLoad(page: Page, ms = 4500): Promise<'ready' | 'config-error' | 'connection-error'> {
  if (ms > 0) await page.waitForTimeout(ms);

  // Firebase settings missing
  if (await page.locator('text=Firebase 設定が不足しています').count() > 0) return 'config-error';
  // Generic app crash (e.g. Firebase SDK crash when config is missing)
  if (await page.locator('text=エラーが発生しました').count() > 0) return 'config-error';
  // Firebase connection error (config present but network/auth failed)
  if (await page.locator('text=接続できませんでした').count() > 0) return 'connection-error';
  return 'ready';
}
