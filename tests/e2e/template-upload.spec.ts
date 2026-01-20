/**
 * テンプレートアップロード機能のE2Eテスト
 * 更新日: 2026_0119_11:34
 */

import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

// このテストの目的:
// - テンプレートアップロードUIとバリデーションのE2Eを確認する
// こんな症状のときに実行:
// - テンプレJSON/背景画像のアップロードが失敗する・バリデーションが通り過ぎる/落ちるなどの挙動確認に使う

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateDir = path.resolve(__dirname, "..", "..", "test-assets", "template");
const templateBg = path.join(templateDir, "bg.png");

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
  await page.waitForSelector('h1:has-text("テンプレート管理")', { timeout: longTimeout });
  await page.waitForTimeout(500);
}

async function waitForToast(page, text: string, timeout = longTimeout) {
  await expect(page.locator('.rounded-xl').filter({ hasText: text })).toBeVisible({ timeout });
}

async function createTestJsonFile(page, templateKey: string, imageFileName: string) {
  const templateJson = {
    templateKey,
    name: `テストテンプレート ${templateKey}`,
    status: "draft",
    paper: { width: 210, height: 297 },
    pdf: { pageSize: "A4", orientation: "portrait", dpi: 300 },
    background: {
      fileName: imageFileName,
      canvasWidthPx: 1000,
      canvasHeightPx: 1414
    },
    engravingArea: {
      x: 100,
      y: 100,
      w: 800,
      h: 1200,
      label: "デザインできる範囲"
    },
    placementRules: {
      allowRotate: true,
      keepInsideEngravingArea: true,
      minScale: 0.1,
      maxScale: 6
    },
    updatedAt: new Date().toISOString()
  };

  const jsonBlob = new Blob([JSON.stringify(templateJson, null, 2)], { type: "application/json" });
  const jsonFile = new File([jsonBlob], "template.json", { type: "application/json" });
  return jsonFile;
}

async function createTestImageFile(page, fileName: string) {
  // 1x1のPNG画像を作成
  const canvas = await page.evaluate((name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1414;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000000";
      ctx.fillRect(100, 100, 800, 1200);
    }
    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        } else {
          resolve("");
        }
      }, "image/png");
    });
  }, fileName);

  if (!canvas) {
    throw new Error("Failed to create test image");
  }

  // DataURLをBlobに変換
  const response = await page.evaluate(async (dataUrl) => {
    const res = await fetch(dataUrl);
    return await res.blob();
  }, canvas);

  return new File([response], fileName, { type: "image/png" });
}

async function uploadFile(page, file: File, inputSelector: string = 'input[type="file"]') {
  const input = await page.locator(inputSelector);
  const dataTransfer = await page.evaluateHandle((fileData) => {
    const dt = new DataTransfer();
    const file = new File([fileData.content], fileData.name, { type: fileData.type });
    dt.items.add(file);
    return dt;
  }, {
    name: file.name,
    type: file.type,
    content: await file.arrayBuffer()
  });

  await input.setInputFiles({
    name: file.name,
    mimeType: file.type,
    buffer: Buffer.from(await file.arrayBuffer())
  });
}

test("TC-UPLOAD-01 同時アップロード：正常系", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const imageFileName = "test-bg.png";

  const jsonFile = await createTestJsonFile(page, templateKey, "bg.png"); // ファイル名をbg.pngに合わせる

  // 両方のファイルを同時にアップロード（両方ともバッファとして扱う）
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles([
    {
      name: jsonFile.name,
      mimeType: jsonFile.type,
      buffer: Buffer.from(await jsonFile.arrayBuffer())
    },
    {
      name: "bg.png",
      mimeType: "image/png",
      buffer: bgBuffer
    }
  ]);

  // 成功メッセージを確認
  await waitForToast(page, "テンプレートを登録しました");
  
  // テンプレートが一覧に表示されることを確認
  await expect(page.locator(`text=${templateKey}`).first()).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ 同時アップロード成功");
});

test("TC-UPLOAD-02 1個ずつアップロード：JSON先", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const imageFileName = "bg.png"; // 既存のテストアセットのファイル名に合わせる

  const jsonFile = await createTestJsonFile(page, templateKey, imageFileName);

  // 1. JSONファイルを先にアップロード
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: jsonFile.name,
    mimeType: jsonFile.type,
    buffer: Buffer.from(await jsonFile.arrayBuffer())
  });

  // 待機メッセージを確認（Toastメッセージ）
  await expect(page.locator('.rounded-xl:has-text("template.json を読み込みました")')).toBeVisible({ timeout: longTimeout });
  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に背景画像をアップロードしてください")')).toBeVisible({ timeout: longTimeout });

  // 2. 画像ファイルをアップロード（既存のテストアセットを使用）
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles({
    name: "bg.png",
    mimeType: "image/png",
    buffer: bgBuffer
  });

  // 成功メッセージを確認
  await waitForToast(page, "テンプレートを登録しました");
  
  // テンプレートが一覧に表示されることを確認
  await expect(page.locator(`text=${templateKey}`).first()).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ JSON先アップロード成功");
});

test("TC-UPLOAD-03 1個ずつアップロード：画像先", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const imageFileName = "bg.png"; // 既存のテストアセットのファイル名に合わせる

  const jsonFile = await createTestJsonFile(page, templateKey, imageFileName);

  // 1. 画像ファイルを先にアップロード（既存のテストアセットを使用）
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles({
    name: "bg.png",
    mimeType: "image/png",
    buffer: bgBuffer
  });

  // 待機メッセージを確認（Toastメッセージ）
  await expect(page.locator('.rounded-xl:has-text("背景画像を読み込みました")')).toBeVisible({ timeout: longTimeout });
  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に template.json をアップロードしてください")')).toBeVisible({ timeout: longTimeout });

  // 2. JSONファイルをアップロード
  await input.setInputFiles({
    name: jsonFile.name,
    mimeType: jsonFile.type,
    buffer: Buffer.from(await jsonFile.arrayBuffer())
  });

  // 成功メッセージを確認（Toastメッセージ）
  await waitForToast(page, "テンプレートを登録しました");
  
  // テンプレートが一覧に表示されることを確認
  await page.waitForTimeout(1000); // リスト更新を待つ
  await expect(page.locator(`text=${templateKey}`).first()).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ 画像先アップロード成功");
});

test("TC-UPLOAD-04 エラー：ファイル名不一致", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const jsonImageName = "different-image.png"; // JSONに書かれた画像名（実際のファイル名と異なる）

  // JSONに書かれたファイル名と実際のファイル名が異なるJSONを作成
  const jsonFile = await createTestJsonFile(page, templateKey, jsonImageName);

  // 両方同時にアップロード（実際のファイルはbg.pngだが、JSONにはdifferent-image.pngと書かれている）
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles([
    {
      name: jsonFile.name,
      mimeType: jsonFile.type,
      buffer: Buffer.from(await jsonFile.arrayBuffer())
    },
    {
      name: "bg.png", // 実際のファイル名
      mimeType: "image/png",
      buffer: bgBuffer
    }
  ]);

  // エラーメッセージを確認（Toastメッセージ）
  await waitForToast(page, "背景画像のファイル名が template.json と一致しません");
  
  // テンプレートが登録されていないことを確認
  await page.waitForTimeout(1000);
  await expect(page.locator(`text=${templateKey}`)).not.toBeVisible({ timeout: 3000 });
  
  console.log("✅ ファイル名不一致エラー確認成功");
});

test("TC-UPLOAD-05 エラー：無効なJSON", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const imageFileName = "bg.png";

  // 無効なJSONファイルを作成
  const invalidJsonContent = '{"invalid": json}';
  const invalidJsonBuffer = Buffer.from(invalidJsonContent, 'utf-8');

  // 両方同時にアップロード
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles([
    {
      name: "template.json",
      mimeType: "application/json",
      buffer: invalidJsonBuffer
    },
    {
      name: "bg.png",
      mimeType: "image/png",
      buffer: bgBuffer
    }
  ]);

  // エラーメッセージを確認（Toastメッセージ）
  // JSON.parseエラーの場合は「テンプレートの登録に失敗しました。」が表示される
  await waitForToast(page, "テンプレートの登録に失敗しました");
  
  console.log("✅ 無効なJSONエラー確認成功");
});

test("TC-UPLOAD-06 エラー：画像ファイルのみ", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  // 画像ファイルのみアップロード
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles({
    name: "bg.png",
    mimeType: "image/png",
    buffer: bgBuffer
  });

  // 待機メッセージを確認（Toastメッセージ）
  await expect(page.locator('.rounded-xl:has-text("背景画像を読み込みました")')).toBeVisible({ timeout: longTimeout });
  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に template.json をアップロードしてください")')).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ 画像のみアップロード（待機状態）確認成功");
});

test("TC-UPLOAD-07 エラー：JSONファイルのみ", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const imageFileName = "test-bg.png";
  const jsonFile = await createTestJsonFile(page, templateKey, imageFileName);

  // JSONファイルのみアップロード
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: jsonFile.name,
    mimeType: jsonFile.type,
    buffer: Buffer.from(await jsonFile.arrayBuffer())
  });

  // 待機メッセージを確認（Toastメッセージ）
  await expect(page.locator('.rounded-xl:has-text("template.json を読み込みました")')).toBeVisible({ timeout: longTimeout });
  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に背景画像をアップロードしてください")')).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ JSONのみアップロード（待機状態）確認成功");
});

test("TC-UPLOAD-08 エラー：対応していないファイル形式", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  // テキストファイルを作成
  const textBlob = new Blob(["これはテキストファイルです"], { type: "text/plain" });
  const textFile = new File([textBlob], "test.txt", { type: "text/plain" });

  // テキストファイルをアップロード
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: textFile.name,
    mimeType: textFile.type,
    buffer: Buffer.from(await textFile.arrayBuffer())
  });

  // エラーメッセージを確認（Toastメッセージ）
  await waitForToast(page, "template.json または背景画像を選択してください");
  
  console.log("✅ 対応していないファイル形式エラー確認成功");
});

test("TC-UPLOAD-09 状態表示：JSON先アップロード後の状態", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  const templateKey = `test_template_${Date.now()}`;
  const imageFileName = "test-bg.png";
  const jsonFile = await createTestJsonFile(page, templateKey, imageFileName);

  // JSONファイルをアップロード
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: jsonFile.name,
    mimeType: jsonFile.type,
    buffer: Buffer.from(await jsonFile.arrayBuffer())
  });

  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("template.json を読み込み済み")')).toBeVisible({ timeout: longTimeout });
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に背景画像をアップロードしてください")')).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ JSON先アップロード後の状態表示確認成功");
});

test("TC-UPLOAD-10 状態表示：画像先アップロード後の状態", async ({ page }) => {
  await resetStorage(page);
  await page.goto("/admin/templates");
  await waitForAppReady(page);

  // 画像ファイルをアップロード
  const input = page.locator('input[type="file"]');
  const bgBuffer = await readFile(templateBg);
  await input.setInputFiles({
    name: "bg.png",
    mimeType: "image/png",
    buffer: bgBuffer
  });

  // 状態表示を確認（より具体的なセレクター）
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("背景画像を読み込み済み")')).toBeVisible({ timeout: longTimeout });
  await expect(page.locator('.rounded-lg.border-amber-200:has-text("次に template.json をアップロードしてください")')).toBeVisible({ timeout: longTimeout });
  
  console.log("✅ 画像先アップロード後の状態表示確認成功");
});

