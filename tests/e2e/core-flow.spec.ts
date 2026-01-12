import path from "path";
import { test, expect } from "@playwright/test";

const templateDir = path.resolve(__dirname, "..", "..", "test-assets", "template");
const logoDir = path.resolve(__dirname, "..", "..", "test-assets", "logo");
const templateJson = path.join(templateDir, "template.json");
const templateBg = path.join(templateDir, "bg.png");
const logoOk = path.join(logoDir, "logo_ok.png");
const logoLarge = path.join(logoDir, "logo_large_6mb.png");

async function resetStorage(page) {
  await page.goto("/top");
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
  const input = page.locator('input[type="file"][accept=".json,image/*"]');
  await input.setInputFiles([templateJson, templateBg]);
  await expect(page.getByText("テストA4 右下刻印")).toBeVisible();
}

async function setTemplateStatus(page, status) {
  const row = page.locator("tr", { hasText: "test_template_a4" });
  const select = row.locator("select").first();
  await select.selectOption(status);
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
  await expect(page.getByText("未公開")).toBeVisible();
});

test("TC-E2E-03 お客様：正常フロー", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  const input = page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.webp"]');
  await input.setInputFiles(logoOk);

  const issueButton = page.getByRole("button", { name: "デザインIDを発行する" });
  await expect(issueButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await issueButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-confirm\.pdf$/);

  await expect(page.getByText(/\d{6}_[A-Z2-9]{8}/)).toBeVisible();
});

test("TC-E2E-04 管理：履歴に残りPDF再取得", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  const input = page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.webp"]');
  await input.setInputFiles(logoOk);
  const issueButton = page.getByRole("button", { name: "デザインIDを発行する" });
  await expect(issueButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await issueButton.click();
  await downloadPromise;

  const designId = await page.getByText(/\d{6}_[A-Z2-9]{8}/).textContent();
  expect(designId).toBeTruthy();

  await page.goto("/admin/designs");
  await expect(page.getByText(designId ?? "")).toBeVisible();
});

test("TC-E2E-05 異常：容量超過", async ({ page }) => {
  await resetStorage(page);
  await registerTemplate(page);
  await setTemplateStatus(page, "tested");

  await page.goto("/sim/test_template_a4");
  const input = page.locator('input[type="file"][accept=".png,.jpg,.jpeg,.webp"]');
  await input.setInputFiles(logoLarge);

  await expect(page.getByText("5MB")).toBeVisible();
});
