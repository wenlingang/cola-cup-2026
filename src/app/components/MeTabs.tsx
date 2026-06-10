"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/me", label: "账本" },
  { href: "/me/settings", label: "设置" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/me") return pathname === "/me";
  return pathname.startsWith(href);
}

export function MeTabs() {
  const pathname = usePathname();

  return (
    <nav className="subtabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={isActive(pathname, tab.href) ? "on" : ""}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
