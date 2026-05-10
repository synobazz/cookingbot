import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { MobileTabbar } from "./_components/mobile-tabbar";
import { ToastProvider } from "./_components/toast";

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

// `viewportFit: "cover"` ist Voraussetzung dafür, dass die im CSS
// genutzten `env(safe-area-inset-*)`-Insets auf iPhone (Notch / Home-
// Indicator) tatsächlich >0 zurückgeben. Ohne diesen Hinweis liegen
// Toast und Tabbar auf iPhones unter dem Home-Indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1e7",
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
        <ToastProvider>
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
        </ToastProvider>
      </body>
    </html>
  );
}
