import { test, expect } from '@playwright/test';
import { waitForAppLoad } from './helpers';

// All tests in this file use iPhone 14 viewport
test.use({ viewport: { width: 390, height: 844 } });

let appReady = false;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  try {
    await page.goto('http://localhost:3000');
    const state = await waitForAppLoad(page, 4500);
    appReady = state === 'ready';
  } finally {
    await ctx.close();
  }
});

test.describe('モバイル ボトムナビ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('ボトムナビバーが表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
  });

  test('ホーム・カレンダー・準備物・その他タブが存在する', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await expect(nav.getByText('ホーム')).toBeVisible();
    await expect(nav.getByText('カレンダー')).toBeVisible();
    await expect(nav.getByText('準備物')).toBeVisible();
    await expect(nav.getByText('その他')).toBeVisible();
  });

  test('カレンダータブをタップするとカレンダービューに切り替わる', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await nav.getByText('カレンダー').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.md\\:hidden').filter({ hasText: 'カレンダー' }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('「その他」タブをタップするとシートが開く', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await nav.getByText('その他').click();
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'メニュー' })).toBeVisible({ timeout: 3_000 });
  });

  test('「その他」シートからスケジュールを選べる', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await nav.getByText('その他').click();
    await page.waitForTimeout(400);
    const sheetItem = page.locator('.rounded-2xl').filter({ hasText: 'スケジュール' }).first();
    await expect(sheetItem).toBeVisible({ timeout: 3_000 });
    await sheetItem.click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'メニュー' })).not.toBeVisible({ timeout: 2_000 });
    await expect(page.locator('.md\\:hidden').filter({ hasText: 'スケジュール' }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('ボトムナビに safe-area-inset-bottom パディングがない', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    const style = await nav.getAttribute('style');
    expect(style ?? '').not.toContain('safe-area-inset-bottom');
  });

  test('管理者ログインボタンがヘッダーに表示される', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    await expect(page.locator('header').getByText(/管理者ログイン/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('カレンダーに切り替えても管理者ログインボタンが残る', async ({ page }) => {
    test.skip(!appReady, 'Firebase 未設定環境ではスキップ');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await nav.getByText('カレンダー').click();
    await page.waitForTimeout(400);
    await expect(page.locator('header').getByText(/管理者ログイン/).first()).toBeVisible({ timeout: 3_000 });
  });
});
