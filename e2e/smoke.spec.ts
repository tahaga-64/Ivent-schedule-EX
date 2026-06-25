import { test, expect } from '@playwright/test';
import { waitForAppLoad } from './helpers';

let appReady = false;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto('http://localhost:3000');
    const state = await waitForAppLoad(page, 4500);
    appReady = state === 'ready';
  } finally {
    await ctx.close();
  }
});

test.describe('アプリ起動 (smoke)', () => {
  test('ページが HTTP 200 で読み込まれる', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  test('Firebase 未設定時に設定エラーページが表示される', async ({ page }) => {
    test.skip(appReady, 'Firebase が設定済みのためスキップ');
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Firebase 設定が不足しています')).toBeVisible();
    await expect(page.locator('pre').filter({ hasText: 'VITE_FIREBASE_API_KEY' })).toBeVisible();
  });

  test('Firebase 設定済み時にメインアプリが表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('header')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).not.toContainText('Firebase 設定が不足しています');
  });
});

test.describe('デスクトップ ナビゲーション', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('カレンダーボタンでビュー切り替え', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    await page.goto('/');
    await page.waitForTimeout(500);
    const calBtn = page.locator('header button').filter({ hasText: 'カレンダー' });
    await expect(calBtn).toBeVisible({ timeout: 5_000 });
    await calBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('header button.bg-indigo-600')).toContainText('カレンダー');
  });

  test('検索バーに入力できる', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    await page.goto('/');
    await page.waitForTimeout(500);
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('テスト');
    await expect(searchInput).toHaveValue('テスト');
    await searchInput.clear();
  });
});
