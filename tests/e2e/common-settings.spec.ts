/**
 * 基本設定ページの保存・復元機能のE2Eテスト
 * 更新日: 2026_0119_11:34
 */

import { test, expect } from "@playwright/test";

// このテストの目的:
// - 共通設定画面の保存・表示がエラーなく動くかを確認するE2E
// こんな症状のときに実行:
// - 共通設定の更新が反映されない/画面でエラーが出る/保存できないときの確認用

const longTimeout = 30000;

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`console error: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`page error: ${err.message}`);
  });
});

async function resetStorage(page) {
  await page.goto("/top");
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("ksim_db");
      request.onsuccess = () => resolve(null);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  });
}

async function waitForAppReady(page) {
  await page.waitForSelector('h1:has-text("基本設定")', { timeout: longTimeout });
  await page.waitForTimeout(500);
}

test("TC-SETTINGS-01 保存ボタンの初期状態", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // 保存ボタンが無効化されていることを確認
  const saveButton = page.locator('button:has-text("保存する")');
  await expect(saveButton).toBeDisabled();
  await expect(saveButton).toHaveClass(/cursor-not-allowed/);

  console.log("✅ 保存ボタンの初期状態確認成功");
});

test("TC-SETTINGS-02 フィールド変更で保存ボタンが有効化される", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // タイトルフィールドを変更
  const titleInput = page.locator('input[placeholder="例）ご利用前のご案内"]');
  await titleInput.fill("テストタイトル");

  // 保存ボタンが有効化されることを確認
  const saveButton = page.locator('button:has-text("保存する")');
  await expect(saveButton).toBeEnabled();
  await expect(saveButton).not.toHaveClass(/cursor-not-allowed/);

  console.log("✅ フィールド変更で保存ボタンが有効化されることを確認");
});

test("TC-SETTINGS-03 保存ボタンで設定が保存される", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // タイトルフィールドを変更
  const titleInput = page.locator('input[placeholder="例）ご利用前のご案内"]');
  const testTitle = `テストタイトル_${Date.now()}`;
  await titleInput.fill(testTitle);

  // 保存ボタンをクリック
  const saveButton = page.locator('button:has-text("保存する")');
  await saveButton.click();

  // 保存成功メッセージを確認
  await expect(page.locator('.rounded-xl:has-text("保存しました")')).toBeVisible({ timeout: longTimeout });

  // 保存ボタンが再び無効化されることを確認
  await expect(saveButton).toBeDisabled();

  // ページをリロードして設定が保持されていることを確認
  await page.reload();
  await waitForAppReady(page);
  await expect(titleInput).toHaveValue(testTitle);

  console.log("✅ 保存ボタンで設定が保存されることを確認");
});

test("TC-SETTINGS-04 複数フィールドの変更が保存される", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // 複数のフィールドを変更
  const titleInput = page.locator('input[placeholder="例）ご利用前のご案内"]');
  const testTitle = `テストタイトル_${Date.now()}`;
  await titleInput.fill(testTitle);

  const bodyTextarea = page.locator('textarea[placeholder*="お客様向けの注意事項"]');
  const testBody = "テスト本文";
  await bodyTextarea.fill(testBody);

  // 保存ボタンをクリック
  const saveButton = page.locator('button:has-text("保存する")');
  await saveButton.click();

  // 保存成功メッセージを確認
  await expect(page.locator('.rounded-xl:has-text("保存しました")')).toBeVisible({ timeout: longTimeout });

  // ページをリロードして設定が保持されていることを確認
  await page.reload();
  await waitForAppReady(page);
  await expect(titleInput).toHaveValue(testTitle);
  await expect(bodyTextarea).toHaveValue(testBody);

  console.log("✅ 複数フィールドの変更が保存されることを確認");
});

test("TC-SETTINGS-05 初期値に戻すボタンの動作", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // トップのタイトルフィールドを変更
  const topTitleInput = page.locator('input[value="デザインシミュレーター"]');
  await topTitleInput.fill("変更されたタイトル");

  // 確認ダイアログでOKをクリックするハンドラーを設定（ボタンクリックの前に）
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("初期値に戻しますか");
    await dialog.accept();
  });

  // 初期値に戻すボタンをクリック
  const restoreButton = page.locator('button:has-text("初期値に戻す")');
  await restoreButton.click();

  // 確認メッセージを確認
  await expect(page.locator('.rounded-xl:has-text("設定を初期値に戻しました")')).toBeVisible({ timeout: longTimeout });

  // トップのタイトルが初期値に戻っていることを確認
  await expect(page.locator('input[value="デザインシミュレーター"]')).toBeVisible({ timeout: longTimeout });

  // 保存ボタンが有効化されていることを確認（変更があるため）
  const saveButton = page.locator('button:has-text("保存する")');
  await expect(saveButton).toBeEnabled();

  console.log("✅ 初期値に戻すボタンの動作確認成功");
});

test("TC-SETTINGS-06 初期値に戻すボタンのキャンセル", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // タイトルフィールドを変更
  const titleInput = page.locator('input[placeholder="例）ご利用前のご案内"]');
  const testTitle = "変更されたタイトル";
  await titleInput.fill(testTitle);

  // 初期値に戻すボタンをクリック
  const restoreButton = page.locator('button:has-text("初期値に戻す")');
  
  // 確認ダイアログでキャンセルをクリック
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  await restoreButton.click();
  await page.waitForTimeout(500);

  // タイトルが変更されたままであることを確認
  await expect(titleInput).toHaveValue(testTitle);

  console.log("✅ 初期値に戻すボタンのキャンセル確認成功");
});

test("TC-SETTINGS-07 ヘッダー/フッター設定の変更が保存される", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // トップのタイトルを変更
  const topTitleInput = page.locator('input[value="デザインシミュレーター"]');
  const testTopTitle = `テストトップタイトル_${Date.now()}`;
  await topTitleInput.fill(testTopTitle);

  // 保存ボタンが有効化されることを確認
  const saveButton = page.locator('button:has-text("保存する")');
  await expect(saveButton).toBeEnabled();

  // 保存ボタンをクリック
  await saveButton.click();

  // 保存成功メッセージを確認
  await expect(page.locator('.rounded-xl:has-text("保存しました")')).toBeVisible({ timeout: longTimeout });

  // ページをリロードして設定が保持されていることを確認
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator(`input[value="${testTopTitle}"]`)).toBeVisible({ timeout: longTimeout });

  console.log("✅ ヘッダー/フッター設定の変更が保存されることを確認");
});

test("TC-SETTINGS-08 保存後に変更がない場合、保存ボタンが無効化される", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/common");
  await waitForAppReady(page);

  // タイトルフィールドを変更
  const titleInput = page.locator('input[placeholder="例）ご利用前のご案内"]');
  await titleInput.fill("テストタイトル");

  // 保存ボタンをクリック
  const saveButton = page.locator('button:has-text("保存する")');
  await saveButton.click();

  // 保存成功メッセージを確認
  await expect(page.locator('.rounded-xl:has-text("保存しました")')).toBeVisible({ timeout: longTimeout });

  // 保存ボタンが無効化されることを確認
  await expect(saveButton).toBeDisabled();

  // さらに変更を加えない場合、保存ボタンが無効化されたままであることを確認
  await page.waitForTimeout(1000);
  await expect(saveButton).toBeDisabled();

  console.log("✅ 保存後に変更がない場合、保存ボタンが無効化されることを確認");
});

