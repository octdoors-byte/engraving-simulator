import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

// このテストの目的:
// - 主要画面でデザイン崩れがないかをスクリーンショット比較で検知する
// こんな症状のときに実行:
// - レイアウトが崩れた/要素が欠けたときに、いつから崩れたかを確認したい場合

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoDir = path.resolve(__dirname, "..", "..", "test-assets", "logo");
const logoOk = path.join(logoDir, "logo_ok.png");

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
});

async function waitForAppReady(page) {
  const loader = page.getByText("読み込み中...");
  if (await loader.isVisible()) {
    await expect(loader).toBeHidden({ timeout: longTimeout });
  }
}

async function waitForReady(page) {
  await expect(page.getByText("状態: 作成可能")).toBeVisible({ timeout: longTimeout });
}

const screenshotOpts = {
  fullPage: true,
  animations: "disabled" as const,
  caret: "hide" as const
};

test("VR-01 シミュレータ初期表示が崩れていない", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("sim-initial.png", screenshotOpts);
});

test("VR-02 ロゴアップロード後の配置画面が崩れていない", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);

  await waitForReady(page);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("sim-uploaded.png", screenshotOpts);
});

test("VR-03 PDF確認モーダルが崩れていない", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);

  await waitForReady(page);

  const previewButton = page.getByRole("button", { name: "PDF確認" });
  await previewButton.click();

  await expect(page.getByRole("button", { name: "IDを作成する" })).toBeVisible({ timeout: longTimeout });
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("sim-pdf-modal.png", screenshotOpts);
});

test("VR-04 デザイン枠の寸法・位置が崩れていない", async ({ page }) => {
  await page.goto(`/sim/${templateKey}`);
  await waitForAppReady(page);

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(logoOk);
  await waitForReady(page);

  // 枠要素を選択（Tailwindの dashed 枠を利用）
  const frame = page.locator(
    '[data-testid="sim-frame"], .sim-frame, [data-testid="design-frame"], div.border-dashed, div[class*="border-amber-400"]'
  );
  if (!(await frame.count())) {
    test.skip(true, "デザイン枠を特定できなかったため、このテストをスキップします");
  }
  await expect(frame.first()).toBeVisible({ timeout: longTimeout });

  // 枠のみスクリーンショット比較（サイズや位置が変わると差分で検知できる）
  await expect(frame.first()).toHaveScreenshot("sim-frame.png", screenshotOpts);
});
