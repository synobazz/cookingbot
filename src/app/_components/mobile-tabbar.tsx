"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, CalendarIcon, CartIcon, HomeIcon } from "./icons";

const items = [
  { href: "/", label: "Heute", Icon: HomeIcon },
  { href: "/recipes", label: "Rezepte", Icon: BookIcon },
  { href: "/planner", label: "Plan", Icon: CalendarIcon },
  { href: "/shopping", label: "Einkauf", Icon: CartIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTabbar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            className="tab-btn"
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
