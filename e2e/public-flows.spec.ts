import { expect, test, type Page } from "@playwright/test";

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("公開ランキングとイベント履歴を閲覧できる", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "得点ランキング" })).toBeVisible();
  expect(await page.getByRole("table").getByRole("row").count()).toBeGreaterThan(1);

  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "イベント一覧" })).toBeVisible();

  const firstEvent = page
    .locator('main a[href^="/events/"]:not([href="/events/new"])')
    .first();
  await expect(firstEvent).toBeVisible();
  const eventPath = await firstEvent.getAttribute("href");
  expect(eventPath).toMatch(/^\/events\/[0-9a-f-]+$/);

  await firstEvent.click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
  await expect(page.getByRole("heading", { name: "試合" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "チーム" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("ランキングの期間操作と集計ダイアログをキーボードで操作できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "前の月へ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "次の月へ" })).toBeVisible();

  const trigger = page.getByRole("button", { name: "集計" });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog", { name: "得点王を決める" });
  await expect(dialog).toBeVisible();
  const fromDate = dialog.getByLabel("開始日");
  const toDate = dialog.getByLabel("終了日");
  await expect(fromDate).toBeVisible();
  await expect(toDate).toBeVisible();
  await expect(dialog.getByRole("button", { name: "集計画面を閉じる" })).toBeVisible();

  await fromDate.fill("2030-01-02");
  await toDate.fill("2030-01-01");
  await dialog.getByRole("button", { name: "GO" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("期間を正しく指定してください");
  await expect(fromDate).toHaveAttribute("aria-invalid", "true");
  await expect(toDate).toHaveAttribute("aria-invalid", "true");

  await fromDate.fill("2030-01-01");
  await expect(fromDate).toHaveAttribute("aria-invalid", "false");
  await expect(toDate).toHaveAttribute("aria-invalid", "false");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("イベント作成画面で3〜4チームを均等編成できる", async ({ page }) => {
  const pageErrors = watchPageErrors(page);

  await page.goto("/events/new");
  await expect(page.getByRole("heading", { name: "イベント作成" })).toBeVisible();

  await page.getByRole("button", { name: "3チーム" }).click();
  const memberButtons = page
    .locator('main button[aria-pressed]')
    .filter({ hasNotText: /チーム/ });
  expect(await memberButtons.count()).toBeGreaterThanOrEqual(6);

  for (let index = 0; index < 6; index += 1) {
    await memberButtons.nth(index).click();
  }

  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await expect(page.getByText("Aチーム（2名）")).toBeVisible();
  await expect(page.getByText("Bチーム（2名）")).toBeVisible();
  await expect(page.getByText("Cチーム（2名）")).toBeVisible();

  await page.getByRole("button", { name: "4チーム" }).click();
  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await expect(page.getByText("Aチーム（2名）")).toBeVisible();
  await expect(page.getByText("Bチーム（2名）")).toBeVisible();
  await expect(page.getByText("Cチーム（1名）")).toBeVisible();
  await expect(page.getByText("Dチーム（1名）")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("1試合につき異なる2チームを選択する", async ({ page }) => {
  await page.goto("/events");
  const eventPath = await page
    .locator('main a[href^="/events/"]:not([href="/events/new"])')
    .first()
    .getAttribute("href");
  expect(eventPath).toBeTruthy();

  await page.goto(`${eventPath}/matches/new`);
  await expect(page.getByRole("heading", { name: "対戦チームを選択" })).toBeVisible();

  const selectors = page.getByRole("combobox");
  await expect(selectors).toHaveCount(2);
  const firstValue = await selectors.nth(0).inputValue();
  const secondValue = await selectors.nth(1).inputValue();
  expect(firstValue).not.toBe(secondValue);
  await expect(page.getByRole("button", { name: "この対戦で試合を開始する" })).toBeEnabled();

  await selectors.nth(1).selectOption(firstValue);
  await expect(page.getByText("異なる2チームを選択してください", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "この対戦で試合を開始する" })).toBeDisabled();
});

test("誤った管理パスコードを拒否する", async ({ page }) => {
  await page.goto("/members");
  await page.getByPlaceholder("メンバー名を入力").fill("   ");
  const trigger = page.getByRole("button", { name: "追加" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "パスコードを入力" });
  await expect(dialog).toBeVisible();
  const passcode = dialog.getByRole("textbox", { name: "管理パスコード" });
  await expect(passcode).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "GO" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passcode).toBeFocused();

  await passcode.fill("00000000");
  await passcode.press("Enter");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(passcode).toHaveAttribute("aria-invalid", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("正しい管理パスコードで認証し、無効入力は書き込まない", async ({ page }) => {
  const managerPassword = process.env.E2E_MANAGER_PASSWORD;
  test.skip(
    !managerPassword || !process.env.PLAYWRIGHT_BASE_URL,
    "デプロイ済み環境とE2E_MANAGER_PASSWORDがある場合だけ実行します",
  );

  await page.goto("/members");
  const deleteButtons = page.getByRole("button", { name: "削除" });
  const beforeCount = await deleteButtons.count();

  await page.getByPlaceholder("メンバー名を入力").fill("   ");
  await page.getByRole("button", { name: "追加" }).click();

  const dialog = page.getByRole("dialog", { name: "パスコードを入力" });
  await dialog.getByRole("textbox", { name: "管理パスコード" }).fill(managerPassword!);
  await dialog.getByRole("button", { name: "GO" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("名前を入力してください")).toBeVisible();
  await expect(deleteButtons).toHaveCount(beforeCount);
});
