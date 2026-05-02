import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { MobileTabbar } from "./_components/mobile-tabbar";
import { SubmitFeedback } from "./submit-feedback";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Cookingbot",
  description: "Wochenplanung aus deinen Paprika-Rezepten",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await requireAuth();

  let counts = { recipes: 0, shopping: 0 };
  if (authed) {
    const [recipes, shopping] = await Promise.all([
      prisma.recipe.count({ where: { inTrash: false } }),
      prisma.shoppingListItem.count({ where: { checked: false } }),
    ]);
    counts = { recipes, shopping };
  }

  return (
    <html lang="de" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <SubmitFeedback />
        <div className="grain" aria-hidden />
        {authed ? (
          <div className="app">
            <Sidebar counts={counts} />
            <main className="main">
              <Topbar />
              {children}
            </main>
            <MobileTabbar />
          </div>
        ) : (
          <main className="login-stage">{children}</main>
        )}
      </body>
    </html>
  );
}
