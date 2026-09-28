import { expect, test } from "@playwright/test";

test.describe("LINE認証ゲート", () => {
  test.skip(process.env.ACCESS_MODE !== "line", "ACCESS_MODE=line の認証検証専用");

  test("未ログインではランキングを含むアプリ全体をログイン画面へ誘導する", async ({ page }) => {
    for (const path of ["/", "/events", "/members"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "LINEでログイン" })).toBeVisible();
      await expect(page.getByRole("link", { name: "ランキング" })).toHaveCount(0);
    }
  });

  test("認証コードのないcallbackはエラー付きログイン画面へ戻る", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=oauth_callback_failed$/);
    await expect(
      page.getByText("LINEログインを完了できませんでした。もう一度お試しください。", {
        exact: true,
      }),
    ).toBeVisible();
  });
});
