"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { BookIcon, CalendarIcon, CartIcon, CogIcon, HomeIcon, LogoutIcon, PantryIcon } from "./icons";
import { PendingForm, PendingButton } from "./pending-form";

type NavCounts = {
  recipes: number;
  shopping: number;
};

type SidebarProps = {
  counts: NavCounts;
};

const items = [
  { href: "/", label: "Heute", Icon: HomeIcon, key: "home" as const },
  { href: "/recipes", label: "Rezepte", Icon: BookIcon, key: "recipes" as const },
  { href: "/planner", label: "Wochenplan", Icon: CalendarIcon, key: "planner" as const },
  { href: "/shopping", label: "Einkauf", Icon: CartIcon, key: "shopping" as const },
  { href: "/pantry", label: "Vorrat", Icon: PantryIcon, key: "pantry" as const },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ counts }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Brand />
      {items.map(({ href, label, Icon, key }) => {
        const active = isActive(pathname, href);
        const badge =
          key === "recipes" && counts.recipes > 0
            ? counts.recipes
            : key === "shopping" && counts.shopping > 0
              ? counts.shopping
              : null;
        return (
          <Link
            key={href}
            className="nav-item"
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
            {badge !== null ? <span className="badge-mini">{badge}</span> : null}
          </Link>
        );
      })}

      <div className="sidebar-footer">
        <Link className="sidebar-foot-btn" href="/settings" aria-current={isActive(pathname, "/settings") ? "page" : undefined}>
          <CogIcon />
          Einstellungen
        </Link>
        <PendingForm action="/api/auth/logout" method="post" pendingMessage="Abmeldung läuft…">
          <PendingButton className="sidebar-foot-btn" type="submit" style={{ width: "100%" }}>
            <LogoutIcon />
            Logout
          </PendingButton>
        </PendingForm>
      </div>
    </aside>
  );
}
