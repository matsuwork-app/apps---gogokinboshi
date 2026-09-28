import { expect, test, type Page } from "@playwright/test";

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("ランキングは得点と参加率を表示し、出場時間を表示しない", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "得点ランキング" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "得点" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "参加率" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "出場時間" })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("ランキングの期間操作と集計ダイアログをキーボードで操作できる", async ({ page }) => {
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "集計" });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog", { name: "得点王を決める" });
  const fromDate = dialog.getByLabel("開始日");
  const toDate = dialog.getByLabel("終了日");
  await fromDate.fill("2030-01-02");
  await toDate.fill("2030-01-01");
  await dialog.getByRole("button", { name: "GO" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("期間を正しく指定してください");
  await expect(fromDate).toHaveAttribute("aria-invalid", "true");
  await expect(toDate).toHaveAttribute("aria-invalid", "true");

  await fromDate.fill("2030-01-01");
  await expect(fromDate).toHaveAttribute("aria-invalid", "false");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("イベント作成画面で3〜4チームを均等編成し、パスコードを求めない", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/events/new");
  await expect(page.getByRole("heading", { name: "イベント作成" })).toBeVisible();

  await page.getByRole("button", { name: "3チーム" }).click();
  const memberButtons = page
    .locator('main button[aria-pressed]')
    .filter({ hasNotText: /チーム/ });
  expect(await memberButtons.count()).toBeGreaterThanOrEqual(6);
  for (let index = 0; index < 6; index += 1) await memberButtons.nth(index).click();

  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await expect(page.getByText("Aチーム（2名）")).toBeVisible();
  await expect(page.getByText("Bチーム（2名）")).toBeVisible();
  await expect(page.getByText("Cチーム（2名）")).toBeVisible();

  await page.getByRole("button", { name: "4チーム" }).click();
  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await expect(page.getByText("Dチーム（1名）")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "パスコードを入力" })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
