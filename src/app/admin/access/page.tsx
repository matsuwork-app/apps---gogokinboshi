import { changeAppUserStatus } from "@/app/actions/access";
import { getAccessMode } from "@/lib/auth/access";
import { listAppUsers } from "@/lib/auth/users";
import { redirect } from "next/navigation";

const statusLabel = {
  pending: "承認待ち",
  approved: "承認済み",
  revoked: "停止中",
} as const;

export default async function AccessAdminPage() {
  if (getAccessMode() === "legacy") redirect("/");
  const users = await listAppUsers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">利用者の承認</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          LINEログインしたメンバーの利用を承認、または停止します。
        </p>
      </div>
      <ul className="space-y-3">
        {users.map((user) => {
          const isAdmin = user.lineUserId === process.env.LINE_ADMIN_USER_ID;
          return (
            <li key={user.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{user.displayName || "名前未設定"}</p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? "管理者" : statusLabel[user.status]}
                  </p>
                </div>
                {!isAdmin ? (
                  <form action={changeAppUserStatus}>
                    <input type="hidden" name="app_user_id" value={user.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={user.status === "approved" ? "revoked" : "approved"}
                    />
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-2 text-sm font-medium"
                    >
                      {user.status === "approved" ? "利用停止" : "承認する"}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">ログイン済みの利用者はいません。</p>
      ) : null}
    </div>
  );
}
