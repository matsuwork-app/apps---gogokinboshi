import { redirect } from "next/navigation";

import { signInWithLine } from "@/app/actions/auth";
import { getAccessMode, getAppUserDestination } from "@/lib/auth/access";
import { getCurrentAppUser } from "@/lib/auth/users";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (getAccessMode() === "legacy") redirect("/");

  const appUser = await getCurrentAppUser();
  if (appUser) redirect(getAppUserDestination(appUser));

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <h1 className="text-2xl font-bold">GOGO金星へログイン</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        閲覧と記録には、メンバーとして承認されたLINEアカウントが必要です。
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          LINEログインを完了できませんでした。もう一度お試しください。
        </p>
      ) : null}
      <form action={signInWithLine} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-md bg-[#06c755] px-4 py-3 font-semibold text-white hover:bg-[#05b34c]"
        >
          LINEでログイン
        </button>
      </form>
    </div>
  );
}
