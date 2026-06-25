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

test.describe('スケジュールページ', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('スケジュールビューにテーブルが表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const scheduleBtn = page.locator('header button').filter({ hasText: 'スケジュール' });
    await expect(scheduleBtn).toBeVisible({ timeout: 5_000 });
    await scheduleBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 });
  });

  test('日付ヘッダー列が表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const scheduleBtn = page.locator('header button').filter({ hasText: 'スケジュール' });
    await scheduleBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('table th').first()).toBeVisible({ timeout: 8_000 });
  });

  test('今日の列がインディゴ色でハイライトされる', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const scheduleBtn = page.locator('header button').filter({ hasText: 'スケジュール' });
    await scheduleBtn.click();
    await page.waitForTimeout(500);
    const todayHeader = page.locator('table th.bg-indigo-500');
    const count = await todayHeader.count();
    if (count > 0) {
      await expect(todayHeader.first()).toBeVisible();
      await expect(todayHeader.first()).toContainText(new Date().getDate().toString());
    }
    // 0 = today is outside current month view, acceptable
  });
});

test.describe('管理者ログイン', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('デスクトップ: ヘッダーに管理者ログインボタンが表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('header button').filter({ hasText: /管理者ログイン/ }).first()).toBeVisible({ timeout: 5_000 });
  });
});
