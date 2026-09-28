import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { AppUserAccess } from "@/lib/auth/access";
import type { Database } from "@/types/database";

export type UpdatedSession = {
  response: NextResponse;
  user: User | null;
  appUser: AppUserAccess | null;
};

export async function updateSession(request: NextRequest): Promise<UpdatedSession> {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(
            ({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { response, user: null, appUser: null };

  const { data: appUser } = await supabase
    .from("app_users")
    .select("line_user_id, role, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const access: AppUserAccess | null =
    appUser &&
    (appUser.role === "admin" || appUser.role === "member") &&
    (appUser.status === "pending" ||
      appUser.status === "approved" ||
      appUser.status === "revoked")
      ? {
          role:
            appUser.role === "admin" &&
            appUser.line_user_id !== process.env.LINE_ADMIN_USER_ID
              ? "member"
              : appUser.role,
          status: appUser.status,
        }
      : null;

  return { response, user, appUser: access };
}

export function copyResponseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.headers.getSetCookie().forEach((cookie) => to.headers.append("set-cookie", cookie));
  return to;
}
