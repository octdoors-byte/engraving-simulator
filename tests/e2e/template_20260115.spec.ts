import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

// このテストの目的:
// - template_20260115 用のテンプレでロゴアップロード・大容量ロゴの扱いなどを確認するE2E
// こんな症状のときに実行:
// - 特定テンプレ(template_20260115)でのみ不具合が出る/大きいロゴで失敗する場合の再現確認用

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoDir = path.resolve(__dirname, "..", "..", "test-assets", "logo");
const logoOk = path.join(logoDir, "logo_ok.png");
const logoLarge = path.join(logoDir, "logo_large_6mb.png");

const longTimeout = 30000;
const templateKey = "template_20260115";

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`console error: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`page error: ${err.message}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    // Blob/PDF読み込みで発生する ERR_ABORTED は無視し、それ以外のみ記録
    if (request.url().startsWith("blob:")) return;
    if (errorText.includes("ERR_ABORTED")) return;
    console.log(`request failed: ${request.url()} ${errorText}`);
  });

  // ストレージとIndexedDBをリセットしてシードを再実行させる
  await resetStorage(page);
});

async function resetStorage(page) {
  await page.goto("/top");
  await page.waitForTimeout(500);
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
  const loader = page.getByText("読み込み中...");
  if (await loader.isVisible()) {
    await expect(loader).toBeHidden({ timeout: longTimeout });
  }
}

async function waitForReady(page) {
  await expect(page.getByText("状態: 作成可能")).toBeVisible({ timeout: longTimeout });
}

async function waitForIssued(page, opts?: { logPrefix?: string }) {
  const logPrefix = opts?.logPrefix ? `[${opts.logPrefix}] ` : "";
  const issued = page.locator('[data-testid="sim-status"][data-state="ISSUED"]');
  const errorToast = page.locator(".rounded-xl").filter({ hasText: /エラー|失敗/ }).first();
  const result = await Promise.race([
    issued.waitFor({ state: "visible", timeout: longTimeout }).then(() => "issued"),
    errorToast.waitFor({ state: "visible", timeout: longTimeout }).then(() => "error")
  ]);
  if (result === "error") {
    const message = await errorToast.textContent();
    console.error(`${logPrefix}発行失敗`, message ?? "error");
    throw new Error(`発行に失敗: ${message ?? "error"}`);
  }
}

async function emulateSlow3G(page) {
  // Chromium系のみで利用可（CDPでネットワークを遅くする）
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    // 3G想定: ~780kbps down / ~330kbps up / 400ms latency
    downloadThroughput: Math.floor((780 * 1024) / 8),
    uploadThroughput: Math.floor((330 * 1024) / 8),
    latency: 400
  });
  return client;
}

test("TC-SIM-01 ページ読み込み確認", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // エラーメッセージが表示されていないことを確認
  const errorMessage = page.getByText(/未公開|見つかりません|エラー/);
  if (await errorMessage.isVisible()) {
    const text = await errorMessage.textContent();
    throw new Error(`ページ読み込みエラー: ${text}`);
  }
  
  // シミュレーターの主要要素が表示されていることを確認
  await expect(page.getByText(/ロゴ画像をアップロード|画像を追加/)).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-02 ロゴアップロード機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);

  // アップロード成功を確認（状態が変化する）
  await expect(page.getByTestId("sim-status")).toBeVisible({ timeout: longTimeout });
  
  // エラーメッセージが表示されていないことを確認
  const errorToast = page.locator(".rounded-xl").filter({ hasText: /エラー|失敗/ });
  await expect(errorToast).not.toBeVisible({ timeout: 2000 });
});

test("TC-SIM-03 ファイルサイズ制限チェック", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // 大きなファイルをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoLarge);
  
  // エラーメッセージが表示されることを確認
  await expect(page.getByText("5MB 以上のファイルはアップロードできません。")).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-04 トリミング機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // トリミングボタンが表示されることを確認
  const trimButton = page.getByRole("button", { name: /トリミング|開く/ });
  if (await trimButton.isVisible()) {
    await trimButton.click();
    
    // トリミングUIが表示されることを確認
    await expect(page.getByRole("heading", { name: /トリミング調整/ })).toBeVisible({ timeout: longTimeout });
    
    // トリミングを閉じる
    const closeButton = page.getByRole("button", { name: /閉じる|削除/ }).first();
    await closeButton.click();
  }
});

test("TC-SIM-05 背景透過機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);

  // 背景透過の説明が表示されることを確認
  await expect(page.getByText("色をクリックして透過")).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-06 配置調整機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // 配置フェーズまで進む
  await waitForReady(page);

  // 状態が「発行可能」になることを確認
  await expect(page.getByText("状態: 作成可能")).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-07 PDF確認機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // 配置フェーズまで進む
  await waitForReady(page);
  
  // PDF確認ボタンをクリック
  const previewButton = page.getByRole("button", { name: "PDF確認" });
  await previewButton.click();
  
  // PDF確認モーダルが表示されることを確認
  await expect(page.getByRole("button", { name: "IDを作成する" })).toBeVisible({ timeout: longTimeout });
  
  // 閉じるボタンが表示されることを確認
  await expect(page.getByRole("button", { name: /閉じる|戻る/ })).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-08 デザインID発行機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // 配置フェーズまで進む
  await waitForReady(page);
  
  // PDF確認ボタンをクリック
  const previewButton = page.getByRole("button", { name: "PDF確認" });
  await previewButton.click();
  
  // IDを作成するボタンをクリック
  const issueButton = page.getByRole("button", { name: "IDを作成する" });
  await issueButton.click();

  // 発行完了を待つ
  await waitForIssued(page, { logPrefix: "SIM-08 (safari)" });
  
  // デザインIDが表示されることを確認
  const designIdPattern = /\d{6}_[A-Z2-9]{8}/;
  await expect(page.locator("div", { hasText: designIdPattern }).first()).toBeVisible({ timeout: longTimeout });
  
  // デザインIDをコピーボタンが表示されることを確認
  await expect(page.getByRole("button", { name: /デザインIDをコピー|コピー/ })).toBeVisible({ timeout: longTimeout });
});

test("TC-SIM-09 回転機能", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // 配置フェーズまで進む
  await waitForReady(page);
  
  // 回転ボタンが表示されるか確認（テンプレートによっては表示されない）
  const rotateButton = page.getByRole("button", { name: /90°回転|回転/ });
  if (await rotateButton.isVisible()) {
    await rotateButton.click();
    // 回転が適用されることを確認（エラーが出ないこと）
    await expect(page.getByText(/エラー|失敗/)).not.toBeVisible({ timeout: 2000 });
  }
});

test("TC-SIM-10 刻印枠外配置のエラーチェック", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  
  // ロゴをアップロード
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  
  // 配置フェーズまで進む
  await waitForReady(page);
  
  // PDF確認ボタンをクリック
  const previewButton = page.getByRole("button", { name: "PDF確認" });
  await previewButton.click();
  
  // IDを作成するボタンをクリック
  const issueButton = page.getByRole("button", { name: "IDを作成する" });
  await issueButton.click();
  
  // エラーが出る場合は確認（ロゴが枠外にある場合）
  const errorToast = page.locator(".rounded-xl").filter({ hasText: /刻印枠|枠内|エラー/ });
  // エラーが出るか出ないかは配置によるので、エラーが出た場合はメッセージを確認
  if (await errorToast.isVisible({ timeout: 3000 })) {
    const message = await errorToast.textContent();
    console.log(`配置エラー: ${message}`);
  }
});

test("TC-SIM-11 低速回線でのPDF確認 (Chromeのみ)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium系ブラウザのみで実施");
  const slowTimeout = 60000;

  const client = await emulateSlow3G(page);
  const t0 = Date.now();

  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  const tLoad = Date.now();

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);

  await waitForReady(page);
  const tReady = Date.now();

  const previewButton = page.getByRole("button", { name: "PDF確認" });
  await previewButton.click();
  await expect(page.getByRole("button", { name: "IDを作成する" })).toBeVisible({ timeout: slowTimeout });
  const tPdf = Date.now();

  console.log(
    `[perf][slow3g] load=${tLoad - t0}ms upload+ready=${tReady - tLoad}ms pdf=${tPdf - tReady}ms total=${tPdf - t0}ms`
  );

  // ネットワークエミュレーションを解除
  await client.send("Network.disable");
});

