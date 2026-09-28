"use client";

import Link from "next/link";

import { logout } from "@/app/actions/auth";

type UserMenuProps = {
  displayName: string | null;
  isAdmin: boolean;
};

export default function UserMenu({ displayName, isAdmin }: UserMenuProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden max-w-28 truncate text-muted-foreground sm:inline">
        {displayName || "LINEユーザー"}
      </span>
      {isAdmin ? (
        <Link
          href="/admin/access"
          className="rounded-md border px-2 py-1.5 font-medium hover:bg-muted"
        >
          承認管理
        </Link>
      ) : null}
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
