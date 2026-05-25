import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { MobileTabbar } from "./_components/mobile-tabbar";
import { ToastProvider } from "./_components/toast";
import { ServiceWorkerRegister } from "./_components/sw-register";
import { IosInstallHint } from "./_components/ios-install-hint";
import { ScrollChrome } from "./_components/scroll-chrome";

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
  manifest: "/manifest.webmanifest",
  // iOS ignoriert die SVG-`icon`-Variante zuverlässig nur für die
  // Browser-Tab-Favicon. Für "Zum Home-Bildschirm" braucht es eine
  // PNG mit fester Größe — wir liefern 180×180 als `apple`-Eintrag.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Auto-Linking deutscher Zutatenangaben ("250g", "2 EL") als
  // Telefonnummer auf iOS Safari unterbinden — sonst werden Zahlen
  // im Rezepttext zu klickbaren tel:-Links.
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    // `default` rendert die iOS-Statusbar weiß/schwarz passend zum
    // hellen Paper-Hintergrund. `black-translucent` würde die Bar
    // transparent machen, dann müsste die App selbst hinter der Bar
    // zeichnen — overkill für unser Layout.
    statusBarStyle: "default",
    title: "Cookingbot",
    startupImage: [
      // Sortiert nach Häufigkeit, damit iOS das erste passende Match nimmt.
      // Media-Queries entsprechen Apples offizieller Liste (Portrait, @device-pixel-ratio).
      {
        url: "/splash/iphone-16-pro-max.png",
        media:
          "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-16.png",
        media:
          "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-14-plus.png",
        media:
          "screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-xs-max.png",
        media:
          "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-13-mini.png",
        media:
          "screen and (device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/iphone-se.png",
        media:
          "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/ipad-pro.png",
        media:
          "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  },
};

// `viewportFit: "cover"` ist Voraussetzung dafür, dass die im CSS
// genutzten `env(safe-area-inset-*)`-Insets auf iPhone (Notch / Home-
// Indicator) tatsächlich >0 zurückgeben. Ohne diesen Hinweis liegen
// Toast und Tabbar auf iPhones unter dem Home-Indicator.
//
// `userScalable: true` + `maximumScale: 5` bleibt bewusst aktiv — die
// App ist persönliches Tool, kein Kiosk. Zoom-Verbote nerven in der
// Küche mit fettigen Fingern mehr als sie helfen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    // Light- und Dark-Variante: das App-Design ist hell, aber wir
    // melden den Browsern beides, damit die iOS-Statusbar und
    // Android-Address-Bar auch im System-Darkmode korrekt eingefärbt
    // werden statt eine kontrastlose graue Bar zu zeigen.
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#1f3a2e" },
  ],
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
          <ServiceWorkerRegister />
          <div className="grain" aria-hidden />
          {authed ? (
            <div className="app">
              <ScrollChrome />
              <Sidebar counts={counts} />
              <main className="main">
                <Topbar />
                {children}
              </main>
              <MobileTabbar />
              <IosInstallHint />
            </div>
          ) : (
            <main className="login-stage">{children}</main>
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
