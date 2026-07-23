import { describe, expect, it } from "vitest";
import {
  stornoGebuehrFaellig,
  berechneStornoGebuehr,
  STORNO_FRIST_STUNDEN,
} from "@/lib/booking/storno";

// BR5 — Stornofrist (2 h vor Start) + 50 %-Gebühr, Premium befreit. Reine Funktionen.

const start = new Date("2026-08-01T18:00:00Z"); // HIIT 18:00 → Grenze 16:00
const stundenVor = (h: number) => new Date(start.getTime() - h * 3_600_000);

describe("stornoGebuehrFaellig (BR5)", () => {
  it("Premium (befreit) ist nie gebührenpflichtig — auch kurzfristig", () => {
    expect(stornoGebuehrFaellig(start, true, stundenVor(0.5))).toBe(false);
  });

  it("außerhalb der Frist (früh genug) → keine Gebühr", () => {
    expect(stornoGebuehrFaellig(start, false, stundenVor(3))).toBe(false);
  });

  it("innerhalb der Frist (< 2 h vor Start) → Gebühr fällig", () => {
    expect(stornoGebuehrFaellig(start, false, stundenVor(1))).toBe(true);
  });

  it("Frist ist exakt STORNO_FRIST_STUNDEN Stunden vor Start", () => {
    expect(STORNO_FRIST_STUNDEN).toBe(2);
    // genau an der Grenze (2 h vorher) ist noch kostenlos …
    expect(stornoGebuehrFaellig(start, false, stundenVor(2))).toBe(false);
    // … eine Minute später nicht mehr.
    const eineMinNachGrenze = new Date(stundenVor(2).getTime() + 60_000);
    expect(stornoGebuehrFaellig(start, false, eineMinNachGrenze)).toBe(true);
  });
});

describe("berechneStornoGebuehr (BR5, 50 %)", () => {
  it("keine Gebühr fällig → null", () => {
    expect(berechneStornoGebuehr(30, false)).toBeNull();
  });
  it("Preis nicht gepflegt (null) → null (nur Flag, kein Betrag)", () => {
    expect(berechneStornoGebuehr(null, true)).toBeNull();
  });
  it("50 % des Einzelpreises", () => {
    expect(berechneStornoGebuehr(30, true)).toBe(15);
    expect(berechneStornoGebuehr(25, true)).toBe(12.5);
  });
  it("auf 2 Nachkommastellen gerundet", () => {
    expect(berechneStornoGebuehr(19.99, true)).toBe(9.99); // 9,995 → 2 Nachkommastellen
    expect(berechneStornoGebuehr(19.9, true)).toBe(9.95);
  });
});
