import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Cookingbot",
  description: "Wochenplanung aus deinen Paprika-Rezepten",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await requireAuth();
  return (
    <html lang="de">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link className="brand" href="/">
              <span className="logo">🍳</span>
              <span>cookingbot</span>
            </Link>
            {authed ? (
              <div className="nav-links">
                <Link href="/recipes">Rezepte</Link>
                <Link href="/planner">Wochenplan</Link>
                <Link href="/shopping">Einkauf</Link>
                <form action="/api/auth/logout" method="post"><button>Logout</button></form>
              </div>
            ) : null}
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
