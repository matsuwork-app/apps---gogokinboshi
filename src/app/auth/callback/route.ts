import { NextResponse, type NextRequest } from "next/server";

import { getAccessMode, getAppUserDestination } from "@/lib/auth/access";
import { syncAppUserFromLine } from "@/lib/auth/users";
import { createClient } from "@/lib/supabase/server";

function loginErrorRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?error=oauth_callback_failed", request.url));
}

export async function GET(request: NextRequest) {
  if (getAccessMode() !== "line") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return loginErrorRedirect(request);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("Failed to exchange LINE authorization code", error);
      return loginErrorRedirect(request);
    }

    const appUser = await syncAppUserFromLine(data.user);
    return NextResponse.redirect(
      new URL(getAppUserDestination(appUser), request.url),
    );
  } catch (error) {
    console.error("Failed to complete LINE login", error);
    try {
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch (signOutError) {
      console.error("Failed to clear incomplete LINE session", signOutError);
    }
    return loginErrorRedirect(request);
  }
}
