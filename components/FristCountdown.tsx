"use client";

import { useEffect, useState } from "react";

// Laufende Restzeit bis `bisISO` (z. B. das 30-Min-Bestätigungsfenster der Warteliste,
// BR2). Zeigt die verbleibende Zeit als mm:ss und tickt jede Sekunde — damit ist die
// Frist permanent sichtbar, nicht nur einmalig als Benachrichtigung.
export function FristCountdown({ bisISO }: { bisISO: string }) {
  const bis = new Date(bisISO).getTime();
  const [restMs, setRestMs] = useState(() => bis - Date.now());

  useEffect(() => {
    setRestMs(bis - Date.now());
    const id = setInterval(() => setRestMs(bis - Date.now()), 1000);
    return () => clearInterval(id);
  }, [bis]);

  if (restMs <= 0) return <>Frist abgelaufen</>;

  const sek = Math.floor(restMs / 1000);
  const mm = String(Math.floor(sek / 60)).padStart(2, "0");
  const ss = String(sek % 60).padStart(2, "0");
  return (
    <>
      noch {mm}:{ss} min
    </>
  );
}
