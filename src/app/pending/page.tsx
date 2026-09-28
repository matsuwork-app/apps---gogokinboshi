import { redirect } from "next/navigation";

import { logout } from "@/app/actions/auth";
import { getAccessMode, hasApprovedAccess } from "@/lib/auth/access";
import { getCurrentAppUser } from "@/lib/auth/users";

export default async function PendingPage() {
  if (getAccessMode() === "legacy") redirect("/");

  const user = await getCurrentAppUser();
  if (!user) redirect("/login");
  if (hasApprovedAccess(user)) redirect("/");

  const revoked = user.status === "revoked";

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-bold">
        {revoked ? "利用が停止されています" : "管理者の承認をお待ちください"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {revoked
          ? "再開が必要な場合は管理者へ連絡してください。"
          : "初回ログインを受け付けました。管理者が承認するとアプリを利用できます。"}
      </p>
      {user.displayName ? <p className="mt-4 font-medium">{user.displayName}</p> : null}
      <form action={logout} className="mt-8">
        <button type="submit" className="rounded-md border px-4 py-2 text-sm">
          ログアウト
        </button>
      </form>
    </div>
  );
}
