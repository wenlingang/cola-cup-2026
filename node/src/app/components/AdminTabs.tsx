"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "结算" },
  { href: "/admin/users", label: "用户" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminTabs() {
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
