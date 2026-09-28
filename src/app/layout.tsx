import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NavBar from "@/components/NavBar";
import { getAccessMode } from "@/lib/auth/access";
import { getCurrentAppUser } from "@/lib/auth/users";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GOGO金星 得点王",
  description: "GOGO金星フットサルクラブ 得点・参加記録管理",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = getAccessMode() === "line" ? await getCurrentAppUser() : null;

  return (
    <html lang="ja">
      <body className={`${geist.className} bg-background min-h-screen`}>
        <NavBar
          user={
            appUser
              ? { displayName: appUser.displayName, isAdmin: appUser.role === "admin" }
              : null
          }
        />
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
