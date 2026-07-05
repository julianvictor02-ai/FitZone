import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getBenutzer } from "@/lib/auth/benutzer";
import { seitenReihenfolge } from "@/lib/navigation";
import { SeitenNavigation } from "./SeitenNavigation";

export const metadata: Metadata = {
  title: "FitZone",
  description: "Kursbuchung, Warteliste und Anwesenheit für das FitZone-Studio",
  applicationName: "FitZone",
  manifest: "/manifest.webmanifest",
  // iOS: als eigenständige App vom Home-Bildschirm starten (Voraussetzung für Web-Push).
  appleWebApp: { capable: true, title: "FitZone", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22c55e",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const benutzer = await getBenutzer();
  const seiten = seitenReihenfolge(benutzer?.rolle ?? null);

  return (
    <html lang="de">
      <body>
        {children}
        <SeitenNavigation seiten={seiten} />
      </body>
    </html>
  );
}
