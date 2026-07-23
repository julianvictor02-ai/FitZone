import { describe, expect, it } from "vitest";
import {
  darfVideoSehen,
  erlaubteVideoTarife,
  darfLivestreamBuchen,
} from "@/lib/content/zugriff";

// BR7 — Content-/Livestream-Zugriff nach Tarif. Reine Funktionen, keine DB.

describe("darfVideoSehen (BR7)", () => {
  it("Basic sieht keine On-Demand-Videos", () => {
    expect(darfVideoSehen("Basic", "Plus")).toBe(false);
    expect(darfVideoSehen("Basic", "Premium")).toBe(false);
  });

  it("Plus sieht Plus-Videos, aber keine Premium-Videos", () => {
    expect(darfVideoSehen("Plus", "Plus")).toBe(true);
    expect(darfVideoSehen("Plus", "Premium")).toBe(false);
  });

  it("Premium sieht alles", () => {
    expect(darfVideoSehen("Premium", "Plus")).toBe(true);
    expect(darfVideoSehen("Premium", "Premium")).toBe(true);
  });
});

describe("erlaubteVideoTarife (Query-Filter)", () => {
  it("Basic → keine Videos", () => {
    expect(erlaubteVideoTarife("Basic")).toEqual([]);
  });
  it("Plus → nur Plus", () => {
    expect(erlaubteVideoTarife("Plus")).toEqual(["Plus"]);
  });
  it("Premium → Plus und Premium", () => {
    expect(erlaubteVideoTarife("Premium")).toEqual(["Plus", "Premium"]);
  });
});

describe("darfLivestreamBuchen (BR7/FZ-018)", () => {
  it("nur bei explizitem Zugriff=true", () => {
    expect(darfLivestreamBuchen(true)).toBe(true);
  });
  it("false und null (Basic/unbestimmt) sperren", () => {
    expect(darfLivestreamBuchen(false)).toBe(false);
    expect(darfLivestreamBuchen(null)).toBe(false);
  });
});
