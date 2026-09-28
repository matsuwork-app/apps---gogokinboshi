import { NextResponse, type NextRequest } from "next/server";

import { getAccessMode } from "@/lib/auth/access";
import { getRouteRedirect } from "@/lib/auth/route-access";
import { copyResponseCookies, updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const mode = getAccessMode();
  if (mode === "legacy") return NextResponse.next();

  const { response, user, appUser } = await updateSession(request);
  const redirectPath = getRouteRedirect(
    request.nextUrl.pathname,
    mode,
    Boolean(user),
    appUser,
  );

  if (!redirectPath) return response;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = redirectPath;
  redirectUrl.search = "";
  return copyResponseCookies(response, NextResponse.redirect(redirectUrl));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
