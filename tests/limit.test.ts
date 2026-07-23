import { describe, expect, it } from "vitest";
import { monatsfenster } from "@/lib/booking/limit";

// BR4 — Basic-Monatslimit zählt pro Kalendermonat (nach Kurs-Datum). Das Fenster
// [Monatserster, nächster Monatserster) ist reine Datumslogik und hier getestet.

describe("monatsfenster (BR4)", () => {
  it("liefert den Kalendermonat des Kurstermins", () => {
    const { von, bis } = monatsfenster(new Date(2026, 6, 15, 18, 0)); // Juli
    expect(von).toEqual(new Date(2026, 6, 1));
    expect(bis).toEqual(new Date(2026, 7, 1));
  });

  it("schlägt über den Jahreswechsel korrekt um (Dezember → Januar)", () => {
    const { von, bis } = monatsfenster(new Date(2026, 11, 31, 23, 59));
    expect(von).toEqual(new Date(2026, 11, 1));
    expect(bis).toEqual(new Date(2027, 0, 1));
  });

  it("Monatserster liegt im Fenster, der nächste Monatserste nicht (halboffen)", () => {
    const { von, bis } = monatsfenster(new Date(2026, 6, 1, 0, 0));
    expect(von.getTime()).toBeLessThanOrEqual(new Date(2026, 6, 1).getTime());
    expect(bis.getTime()).toBeGreaterThan(new Date(2026, 6, 31).getTime());
  });
});
