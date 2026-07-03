import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitZone",
  description: "Kursbuchung, Warteliste und Anwesenheit für das FitZone-Studio",
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
