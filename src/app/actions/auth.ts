"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessMode } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl(origin: string | null): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL || origin;
  if (!value) throw new Error("NEXT_PUBLIC_SITE_URL is not configured");

  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) URL");
  }
  return url.origin;
}

export async function signInWithLine(): Promise<void> {
  if (getAccessMode() !== "line") redirect("/");

  const requestHeaders = await headers();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "custom:line",
    options: {
      redirectTo: `${getSiteUrl(requestHeaders.get("origin"))}/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error("Failed to start LINE login", error);
    redirect("/login?error=oauth_start_failed");
  }

  redirect(data.url);
}

export async function logout(): Promise<void> {
  if (getAccessMode() === "line") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Failed to sign out", error);
  }
  redirect("/login");
}
