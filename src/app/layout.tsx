import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { SubmitFeedback } from "./submit-feedback";

export const metadata: Metadata = {
  title: "Cookingbot",
  description: "Wochenplanung aus deinen Paprika-Rezepten",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await requireAuth();
  return (
    <html lang="de">
      <body>
        <SubmitFeedback />
        {authed ? (
          <div className="app-shell">
            <aside className="sidebar">
              <Link className="brand" href="/">
                <span className="brand-mark">c</span>
                <span className="brand-name"><b>cookingbot</b><small>Familienküche</small></span>
              </Link>
              <nav className="side-nav" aria-label="Hauptnavigation">
                <Link href="/">Heute</Link>
                <Link href="/recipes">Rezepte</Link>
                <Link href="/planner">Wochenplan</Link>
                <Link href="/shopping">Einkauf</Link>
              </nav>
              <form className="sidebar-footer" action="/api/auth/logout" method="post"><button type="submit">Logout</button></form>
            </aside>
            <header className="topbar">
              <Link className="brand compact" href="/"><span className="brand-mark">c</span><span className="brand-name"><b>cookingbot</b></span></Link>
            </header>
            <main className="main">{children}</main>
            <nav className="tabbar" aria-label="Mobile Navigation">
              <Link href="/">Heute</Link>
              <Link href="/recipes">Rezepte</Link>
              <Link href="/planner">Plan</Link>
              <Link href="/shopping">Einkauf</Link>
            </nav>
          </div>
        ) : (
          <main className="auth-shell">{children}</main>
        )}
      </body>
    </html>
  );
}
