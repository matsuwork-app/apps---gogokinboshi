import { describe, expect, it } from "vitest";

import { extractLineProfile, resolvePersistedAccess } from "./profile";

describe("LINE OIDCプロフィール", () => {
  it("custom:line identityのID token claimsをプロフィールへ変換する", () => {
    expect(
      extractLineProfile({
        id: "auth-user",
        identities: [
          {
            provider: "custom:line",
            identity_data: {
              sub: "line-user",
              name: "金星 太郎",
              picture: "https://example.com/avatar.png",
            },
          },
        ],
        user_metadata: {},
      }),
    ).toEqual({
      authUserId: "auth-user",
      lineUserId: "line-user",
      displayName: "金星 太郎",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("identity claimが不足する場合はuser_metadataを補助に使う", () => {
    expect(
      extractLineProfile({
        id: "auth-user",
        identities: [{ provider: "custom:line", identity_data: {} }],
        user_metadata: { sub: "line-user", name: "太郎", picture: "not-a-url" },
      }),
    ).toEqual({
      authUserId: "auth-user",
      lineUserId: "line-user",
      displayName: "太郎",
      avatarUrl: null,
    });
  });

  it("LINE identityまたはsubが無いユーザーを拒否する", () => {
    expect(() =>
      extractLineProfile({
        id: "auth-user",
        identities: [{ provider: "google", identity_data: { sub: "other" } }],
        user_metadata: {},
      }),
    ).toThrow("LINE identity");
  });

  it("既存一般利用者の状態を維持し、管理者だけ強制的に承認する", () => {
    expect(resolvePersistedAccess("member", "revoked", false)).toEqual({
      role: "member",
      status: "revoked",
    });
    expect(resolvePersistedAccess("member", "pending", true)).toEqual({
      role: "admin",
      status: "approved",
    });
    expect(resolvePersistedAccess(null, null, false)).toEqual({
      role: "member",
      status: "pending",
    });
  });
});
