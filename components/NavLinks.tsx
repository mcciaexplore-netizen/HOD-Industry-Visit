"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isAdmin, wide }: { isAdmin: boolean; wide: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Report a Visit", active: pathname === "/" },
    { href: "/visits", label: "My Visits", active: pathname.startsWith("/visits") },
    ...(isAdmin
      ? [
          { href: "/admin", label: "All Reports", active: pathname === "/admin" || pathname.startsWith("/admin/visits") },
          { href: "/admin/hods", label: "HODs", active: pathname.startsWith("/admin/hods") },
        ]
      : []),
  ];
  return (
    <nav className={`mx-auto flex gap-1 overflow-x-auto px-2 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            l.active ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
