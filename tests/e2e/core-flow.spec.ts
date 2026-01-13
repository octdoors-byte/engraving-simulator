import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateDir = path.resolve(__dirname, "..", "..", "test-assets", "template");
const logoDir = path.resolve(__dirname, "..", "..", "test-assets", "logo");
const templateJson = path.join(templateDir, "template.json");
const templateBg = path.join(templateDir, "bg.png");
const logoOk = path.join(logoDir, "logo_ok.png");
const logoLarge = path.join(logoDir, "logo_large_6mb.png");

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
  page.on("requestfailed", (request) => {
    console.log(`request failed: ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
});

async function resetStorage(page) {
  await page.goto("/top");
  await waitForAppReady(page);
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

async function registerTemplate(page) {
  await page.goto("/admin/templates");
  await waitForAppReady(page);
  const input = page.locator('input[type="file"][accept=".json,image/*"]');
  await input.setInputFiles([templateJson, templateBg]);
  await expect(page.getByText("テストA4 右下刻印")).toBeVisible();
}

async function setTemplateStatus(page, status) {
  const row = page.locator("tr", { hasText: "test_template_a4" });
  const select = row.locator("select").first();
  await select.selectOption(status);
  await expect(page.getByText("状態を更新しました。")).toBeVisible();
}

async function uploadLogo(page, filePath) {
  await waitForAppReady(page);
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);
}

async function waitForAppReady(page) {
  const loader = page.getByText("読み込み中...");
  if (await loader.isVisible()) {
    await expect(loader).toBeHidden({ timeout: longTimeout });
  }
}

async function waitForReady(page) {
  await expect(page.getByText("状態: 発行可能")).toBeVisible({ timeout: longTimeout });
}

async function waitForIssued(page) {
  const issued = page.locator('[data-testid="sim-status"][data-state="ISSUED"]');
  const errorToast = page.locator(".rounded-xl").filter({ hasText: /エラー|失敗/ }).first();
  const result = await Promise.race([
    issued.waitFor({ state: "visible", timeout: longTimeout }).then(() => "issued"),
    errorToast.waitFor({ state: "visible", timeout: longTimeout }).then(() => "error")
  ]);
  if (result === "error") {
    const message = await errorToast.textContent();
    throw new Error(`発行に失敗: ${message ?? "error"}`);
  }
}

async function getDesignIndex(page) {
  return page.evaluate(() => localStorage.getItem("ksim:designs:index"));
}

async function waitForDesignsTable(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes("ページが見つかりません")) {
    throw new Error(`デザイン履歴ページが見つかりません: ${page.url()}`);
  }
  await expect(page.getByRole("heading", { name: "デザイン発行履歴" })).toBeVisible({ timeout: longTimeout });
  const emptyMessage = page.getByText("デザイン発行履歴がありません。", { exact: true });
  const firstRow = page.locator("tbody tr").first();
  await Promise.race([
    emptyMessage.waitFor({ state: "visible", timeout: longTimeout }).then(() => "empty"),
    firstRow.waitFor({ state: "visible", timeout: longTimeout }).then(() => "row")
  ]);
  const rows = await page.locator("tbody tr").count();
  if (rows === 0) {
    const tbodyHtml = await page.evaluate(() => document.querySelector("tbody")?.innerHTML ?? "");
    throw new Error(`デザイン履歴が表示されません（行数0）: ${tbodyHtml}`);
  }
}

test("TC-E2E-01 管理：テンプレ登録（D&D）", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await expect(page.getByText("テストA4 右下刻印")).toBeVisible();
});

test("TC-E2E-02 管理：公開制御", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await page.goto("/sim/test_template_a4");
  await waitForAppReady(page);
  await expect(page.getByText(/未公開|見つかりません/)).toBeVisible();
});

test("TC-E2E-03 お客様：正常フロー", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  await waitForAppReady(page);
  await uploadLogo(page, logoOk);
  await waitForReady(page);

  const issueButton = page.getByRole("button", { name: "デザインIDを発行する" });
  await issueButton.click();
  await waitForIssued(page);

  const issuedText = await page.locator("div", { hasText: /\d{6}_[A-Z2-9]{8}/ }).first().textContent();
  const issuedMatch = issuedText?.match(/\d{6}_[A-Z2-9]{8}/);
  const issuedId = issuedMatch?.[0];
  expect(issuedId).toBeTruthy();

  const indexValue = await getDesignIndex(page);
  expect(indexValue).not.toBeNull();

  const designsResponse = await page.goto("/admin/designs");
  await waitForAppReady(page);
  await waitForDesignsTable(page);
  if (issuedId) {
    await expect(page.getByText(issuedId, { exact: true })).toBeVisible({ timeout: longTimeout });
  }
});

test("TC-E2E-04 管理：履歴に残りPDF再取得", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  await waitForAppReady(page);
  await uploadLogo(page, logoOk);
  await waitForReady(page);

  const issueButton = page.getByRole("button", { name: "デザインIDを発行する" });
  await issueButton.click();
  await waitForIssued(page);

  const issuedText = await page.locator("div", { hasText: /\d{6}_[A-Z2-9]{8}/ }).first().textContent();
  const issuedMatch = issuedText?.match(/\d{6}_[A-Z2-9]{8}/);
  const issuedId = issuedMatch?.[0];
  expect(issuedId).toBeTruthy();

  const indexValue = await getDesignIndex(page);
  expect(indexValue).not.toBeNull();

  const designsResponse = await page.goto("/admin/designs");
  await waitForAppReady(page);
  await waitForDesignsTable(page);
  if (issuedId) {
    await expect(page.getByText(issuedId, { exact: true })).toBeVisible({ timeout: longTimeout });
  }

  const previewButton = page.getByRole("button", { name: "確認用プレビュー" }).first();
  await previewButton.click();
  await expect(page.getByRole("button", { name: "ダウンロード" })).toBeEnabled({ timeout: longTimeout });
});

test("TC-E2E-05 異常：容量超過", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  await waitForAppReady(page);
  await uploadLogo(page, logoLarge);

  await expect(page.getByText("5MB 以上のファイルはアップロードできません。")).toBeVisible();
});
