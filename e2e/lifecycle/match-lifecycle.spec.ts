import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const MEMBER_NAMES = ["E2E-A", "E2E-B", "E2E-C"] as const;
const EVENT_MARKER = "E2E-LIFECYCLE";

let admin: SupabaseClient;
let eventId: string | null = null;
let matchId: string | null = null;

async function countOpenIntervals(id: string) {
  const { count, error } = await admin
    .from("playing_intervals")
    .select("id", { count: "exact", head: true })
    .eq("match_id", id)
    .is("ended_at", null);
  if (error) throw error;
  return count;
}

test.beforeAll(async () => {
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  await admin.from("events").delete().like("notes", `${EVENT_MARKER}%`);
});

test.afterAll(async () => {
  if (eventId) await admin.from("events").delete().eq("id", eventId);
  else await admin.from("events").delete().like("notes", `${EVENT_MARKER}%`);
});

test("3チームイベントから試合終了まで状態と記録を永続化する", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/events/new");
  await page.getByLabel("メモ（任意）").fill(`${EVENT_MARKER}-${Date.now()}`);
  await page.getByRole("button", { name: "3チーム" }).click();
  for (const memberName of MEMBER_NAMES) {
    await page.getByRole("button", { name: memberName, exact: true }).click();
  }
  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await expect(page.getByText("Aチーム（1名）")).toBeVisible();
  await expect(page.getByText("Bチーム（1名）")).toBeVisible();
  await expect(page.getByText("Cチーム（1名）")).toBeVisible();

  await page.getByRole("button", { name: "イベントを作成する" }).click();
  const passcodeDialog = page.getByRole("dialog", { name: "パスコードを入力" });
  await passcodeDialog
    .getByRole("textbox", { name: "管理パスコード" })
    .fill(process.env.E2E_MANAGER_PASSWORD!);
  await passcodeDialog.getByRole("button", { name: "GO" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]+$/);
  eventId = page.url().match(/\/events\/([0-9a-f-]+)$/)?.[1] ?? null;
  expect(eventId).toBeTruthy();

  const { data: eventTeams, error: eventTeamsError } = await admin
    .from("event_teams")
    .select("id, team_code")
    .eq("event_id", eventId!)
    .order("sort_order");
  expect(eventTeamsError).toBeNull();
  expect(eventTeams?.map((team) => team.team_code)).toEqual(["A", "B", "C"]);

  await page.getByRole("link", { name: "試合を追加" }).click();
  const restingTeams = page.getByRole("heading", { name: "休憩チーム" }).locator("..");
  await expect(restingTeams.getByText("C: チームC", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "この対戦で試合を開始する" }).click();
  await page.waitForURL(/\/matches\/[0-9a-f-]+$/);
  matchId = page.url().match(/\/matches\/([0-9a-f-]+)$/)?.[1] ?? null;
  expect(matchId).toBeTruthy();

  const { data: pendingMatch } = await admin
    .from("matches")
    .select("status")
    .eq("id", matchId!)
    .single();
  expect(pendingMatch?.status).toBe("pending");

  await page.getByRole("button", { name: "キックオフ" }).click();
  await expect(page.getByTestId("match-status")).toHaveText("進行中");
  await expect.poll(async () => countOpenIntervals(matchId!)).toBe(2);

  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "一時停止" }).click();
  await expect(page.getByTestId("match-status")).toHaveText("一時停止中");
  await expect.poll(async () => countOpenIntervals(matchId!)).toBe(0);

  await page.getByRole("button", { name: "再開" }).click();
  await expect(page.getByTestId("match-status")).toHaveText("進行中");
  await expect.poll(async () => countOpenIntervals(matchId!)).toBe(2);

  await page.getByRole("button", { name: "E2E-Aに1点追加" }).click();
  await expect(page.getByLabel("E2E-A 1得点")).toBeVisible();
  await expect(page.getByTestId("score-side-1")).toHaveText("1");

  await page.getByRole("button", { name: "E2E-Aをベンチに変更" }).click();
  await expect(page.getByRole("button", { name: "E2E-Aを出場中に変更" })).toBeVisible();
  await page.getByRole("button", { name: "E2E-Aを出場中に変更" }).click();
  await expect(page.getByRole("button", { name: "E2E-Aをベンチに変更" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "試合終了" }).click();
  await expect(page.getByTestId("match-status")).toHaveText("終了");
  await expect.poll(async () => countOpenIntervals(matchId!)).toBe(0);

  await page.reload();
  await expect(page.getByTestId("match-status")).toHaveText("終了");
  await expect(page.getByLabel("E2E-A 1得点")).toBeVisible();
  await expect(page.getByTestId("score-side-1")).toHaveText("1");

  const { data: finishedMatch, error: finishedMatchError } = await admin
    .from("matches")
    .select("status, started_at, ended_at, active_started_at")
    .eq("id", matchId!)
    .single();
  expect(finishedMatchError).toBeNull();
  expect(finishedMatch?.status).toBe("finished");
  expect(finishedMatch?.started_at).toBeTruthy();
  expect(finishedMatch?.ended_at).toBeTruthy();
  expect(finishedMatch?.active_started_at).toBeNull();

  const { count: goalCount, error: goalCountError } = await admin
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId!);
  expect(goalCountError).toBeNull();
  expect(goalCount).toBe(1);

  const { count: intervalCount, error: intervalCountError } = await admin
    .from("playing_intervals")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId!);
  expect(intervalCountError).toBeNull();
  expect(intervalCount).toBeGreaterThan(2);
});
