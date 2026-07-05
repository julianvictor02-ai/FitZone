import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
