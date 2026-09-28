"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "@/components/auth/UserMenu";

const navItems = [
  { href: "/", label: "ランキング", icon: Trophy },
  { href: "/events", label: "イベント", icon: Calendar },
  { href: "/members", label: "メンバー", icon: Users },
];

export default function NavBar({
  user,
}: {
  user: { displayName: string | null; isAdmin: boolean } | null;
}) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/pending") return null;

  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 sm:flex-nowrap">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight whitespace-nowrap">
            <Image src="/logo3.png" alt="GOGO金星" width={50} height={50} />
            GOGO金星
          </Link>
          <div className="order-3 flex w-full justify-around gap-1 border-t pt-1 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors whitespace-nowrap",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
          {user ? <UserMenu displayName={user.displayName} isAdmin={user.isAdmin} /> : null}
        </div>
      </div>
    </nav>
  );
}
