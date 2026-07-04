# FZ-010 — Buchungslimits pro Tarif

_Konzept / Plan. Quelle: `docs/spec.md §4 BR4`, §5 W3/W4, §10. Status: done._

## Ziel

Basic-Mitglieder buchen **max. 5 Kurse pro Kalendermonat** (hart); Plus/Premium haben
**kein Zähllimit**. Grundlage: `tarif.buchungslimit_pro_monat` (Basic = 5, Plus/Premium = null).

## Business Rule (BR4)

> Basic: max. 5 Buchungen/Monat (hart). Plus: kein festes Limit. Premium: unbegrenzt.
> Akzeptanz: die 6. Basic-Buchung im selben Monat wird abgelehnt; Plus/Premium werden nicht
> durch ein Zähllimit blockiert. (W3: „6/Woche" war illustrativ; W4: Plus kein festes Limit.)

## Akzeptanzkriterien (alle per `npm run verify:fz010` grün, 9/9)

- [x] Basic: erste 5 Buchungen im Kalendermonat bestätigt, 6. → `limit_erreicht` (limit=5).
- [x] Storno gibt einen Slot frei → danach wieder buchbar.
- [x] Buchung im Folgemonat trotz vollem Vormonat erlaubt (Monatsgrenze).
- [x] Plus/Premium: 6 Buchungen im Monat alle bestätigt (kein Limit).
- [x] Nachrücken (Warteliste → Buchung) respektiert das Limit: Basic am Limit → `limit_erreicht`.
- [x] Nachrücken ohne Limit (Plus) → `nachgerueckt`.
- [x] Keine Regression: `verify:fz001–003` bleiben grün.

## Lösungsansatz

`lib/booking/limit.ts`:
- `monatsfenster(kurszeit)` — Kalendermonat `[Monatserster, nächster Monatserster)`.
- `pruefeMonatslimit(tx, mitgliedId, start)` — lädt `tarif.buchungslimit_pro_monat`; bei
  `null` immer erlaubt. Sonst zählt es **bestätigte** Buchungen des Mitglieds mit
  `kurstermin.start` im selben Monat; `anzahl >= limit` → abgelehnt.

Durchsetzung (neuer Status `limit_erreicht`), jeweils in der bestehenden Transaktion, erst
wenn wirklich eine Buchung entstünde:
- `lib/booking/buchung.ts` (`bucheKurstermin`) — nach der Kapazitäts-/„voll"-Prüfung.
- `lib/booking/warteliste.ts` (`bestaetigeNachrueckung`) — vor dem Insert; Angebot bleibt bis
  Fristablauf bestehen.

UI: `app/kurse/KursterminAktion.tsx` zeigt „Monatslimit erreicht (Basic: 5/Monat)".

## Designentscheidungen (siehe decisions.md 2026-07-04)

- **Nach Kurs-Datum, Kalendermonat** (nicht Buchungs-Zeitpunkt) — verhindert Vorausbuchen.
- **Nur aktive Buchungen** — Storno gibt Platz frei; Missbrauch → BR6 (No-Show).
- **Warteliste-Beitritt frei**; Limit greift erst beim Nachrücken.

## Bewusst NICHT in v1

- **Proaktives Ausgrauen** des Buchen-Buttons bei erreichtem Limit — v1 meldet die Ablehnung
  erst beim Klick. (Bewusst simpel; könnte später ergänzt werden.)
- **Cross-Termin-Atomarität**: gleichzeitige Buchungen verschiedener Termine desselben
  Mitglieds werden nicht serialisiert (Near-Zero-Fall, kein Überbuchungsrisiko).

## Offen / Annahmen

- **Kalendermonat vs. rollierend** und die Zählweise (Kurs-Datum, Storno-Freigabe) sind
  Annahmen — mit Kundin bestätigen (spec §8).
- Monatsgrenzen nutzen server-lokale Monatsanfänge (Zeitzonen-Feinheit an Monatsrändern offen).
