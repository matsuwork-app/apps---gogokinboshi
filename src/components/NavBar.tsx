"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Trophy, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "ランキング", icon: Trophy },
  { href: "/events", label: "イベント", icon: Calendar },
  { href: "/members", label: "メンバー", icon: Users },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight whitespace-nowrap">
            <Image src="/logo3.png" alt="GOGO金星" width={50} height={50} />
            GOGO金星
          </Link>
          <div className="flex gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors whitespace-nowrap",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
