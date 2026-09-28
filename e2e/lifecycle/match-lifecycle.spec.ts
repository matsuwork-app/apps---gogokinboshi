import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { createManagerSessionToken } from "../../src/lib/auth/crypto";

const MEMBER_NAMES = ["E2E-A", "E2E-B", "E2E-C"] as const;
const EVENT_MARKER = "E2E-TURN-LIFECYCLE";
const MANAGER_SESSION_COOKIE = "gogokinboshi_manager_session";

let admin: SupabaseClient;
let eventId: string | null = null;

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

test("3チームの得点入力、タイマー、組み替え後の第2ターンを永続化する", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const sessionSecret = process.env.MANAGER_SESSION_SECRET!;
  await context.addCookies([
    {
      name: MANAGER_SESSION_COOKIE,
      value: createManagerSessionToken(sessionSecret),
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/events/new");
  await page.getByLabel("メモ（任意）").fill(`${EVENT_MARKER}-${Date.now()}`);
  await page.getByRole("button", { name: "3チーム" }).click();
  for (const memberName of MEMBER_NAMES) {
    await page.getByRole("button", { name: memberName, exact: true }).click();
  }
  await page.getByRole("button", { name: "均等に振り分け" }).click();
  await page.getByRole("button", { name: "イベントを作成する" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]+$/);
  eventId = page.url().match(/\/events\/([0-9a-f-]+)$/)?.[1] ?? null;
  expect(eventId).toBeTruthy();

  await expect(page.getByRole("heading", { name: "第1ターン" })).toBeVisible();
  await page.getByRole("link", { name: "得点入力を開く" }).click();
  await page.waitForURL(/\/turns\/[0-9a-f-]+$/);

  await expect(page.getByRole("timer")).toHaveText("07:00");
  await page.getByRole("button", { name: "5分" }).click();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await page.getByRole("button", { name: "開始" }).click();
  await expect(page.getByRole("button", { name: "一時停止" })).toBeVisible();
  await page.getByRole("button", { name: "一時停止" }).click();
  await page.getByRole("button", { name: "リセット" }).click();
  await expect(page.getByRole("timer")).toHaveText("05:00");

  await page.getByRole("button", { name: "E2E-Aの得点を1点追加" }).click();
  await expect(page.getByLabel("E2E-A ターン得点 1点")).toBeVisible();
  await expect(page.getByLabel("E2E-A 本日 1点")).toBeVisible();

  await page.getByRole("link", { name: "イベント詳細へ戻る" }).click();
  await page.getByRole("link", { name: "チームを組み替え" }).click();
  await page.getByLabel("E2E-Aの所属チーム").selectOption({ label: "C: チームC" });
  await page.getByLabel("E2E-Cの所属チーム").selectOption({ label: "A: チームA" });
  await page.getByRole("button", { name: "新しいターンを作成" }).click();
  await page.waitForURL(/\/turns\/[0-9a-f-]+$/);

  await expect(page.getByRole("heading", { name: "第2ターン" })).toBeVisible();
  await expect(page.getByLabel("E2E-A ターン得点 0点")).toBeVisible();
  await expect(page.getByLabel("E2E-A 本日 1点")).toBeVisible();
  await page.getByRole("button", { name: "E2E-Aの得点を1点追加" }).click();
  await expect(page.getByLabel("E2E-A 本日 2点")).toBeVisible();

  const { data: turns, error: turnsError } = await admin
    .from("event_turns")
    .select("id,turn_number")
    .eq("event_id", eventId!)
    .order("turn_number");
  expect(turnsError).toBeNull();
  expect(turns?.map(({ turn_number }) => turn_number)).toEqual([1, 2]);

  const { count: goalCount, error: goalError } = await admin
    .from("goals")
    .select("id", { count: "exact", head: true })
    .in("event_turn_id", turns!.map(({ id }) => id));
  expect(goalError).toBeNull();
  expect(goalCount).toBe(2);

  const { data: snapshots, error: snapshotsError } = await admin
    .from("turn_team_members")
    .select("event_turn_id,member_id,event_team_id")
    .in("event_turn_id", turns!.map(({ id }) => id));
  expect(snapshotsError).toBeNull();
  expect(snapshots).toHaveLength(6);
  const firstA = snapshots?.find(
    ({ event_turn_id, member_id }) =>
      event_turn_id === turns![0].id && member_id === "10000000-0000-4000-8000-000000000001",
  );
  const secondA = snapshots?.find(
    ({ event_turn_id, member_id }) =>
      event_turn_id === turns![1].id && member_id === "10000000-0000-4000-8000-000000000001",
  );
  expect(firstA?.event_team_id).not.toBe(secondA?.event_team_id);
});
