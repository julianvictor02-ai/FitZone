import type { NextConfig } from "next";

// Lint + Type-Check laufen als Build-Gate mit (kein Skip): `npm run lint` und
// `tsc --noEmit` sind grün, deshalb bricht der Build bei neu eingeschleusten Fehlern
// bewusst ab, statt sie stumm durchzulassen.
const nextConfig: NextConfig = {
  // Dev-Overlay-Badge in die obere Ecke, damit es im Dev-Modus nicht den
  // fixierten "Zurück"-Button unten links überdeckt und dessen Taps abfängt.
  // (Nur Dev-DX; im Production-Build existiert das Overlay ohnehin nicht.)
  devIndicators: { position: "top-left" },
};

export default nextConfig;

