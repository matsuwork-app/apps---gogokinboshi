import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NavBar from "@/components/NavBar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GOGO金星 得点王",
  description: "GOGO金星フットサルクラブ 得点・出場時間管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geist.className} bg-background min-h-screen`}>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
