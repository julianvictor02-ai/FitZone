# FZ-003 — Selbst-Stornierung (Fristen + Gebühren-Flag)

_Konzept / Plan. Quelle: `docs/spec.md §4 BR5`, §7. Status: done._

## Ziel

Mitglieder stornieren eigene Buchungen selbst. Es wird ein `stornozeitpunkt`
gespeichert und die Gebührenpflicht **als Flag** markiert (keine Auto-Abbuchung in
v1). Ein frei werdender Platz löst das Nachrücken der Warteliste aus (FZ-002).

## Business Rule (BR5)

> Storno nach der Frist (Richtwert 2 h vor Start) → bei Nicht-Premium
> `storno_gebuehr_faellig=true` (Richtwert 50 % Kurspreis); Premium ist befreit.
> `stornozeitpunkt` wird gespeichert; Betrag wickelt der Admin manuell ab.

## Akzeptanzkriterien (alle per `npm run verify:fz003` grün)

- [x] Storno setzt `buchungsstatus=storniert` + `stornozeitpunkt`.
- [x] Nicht-befreiter Tarif storniert **innerhalb** der Frist → `gebuehr_faellig=true`.
- [x] Storno **außerhalb** der Frist → keine Gebühr.
- [x] Premium (`storno_gebuehr_befreit`) → nie Gebühr.
- [x] Frei gewordener Platz (künftiger Termin) → Warteliste rückt automatisch nach.
- [x] Storno ohne aktive Buchung → `keine_buchung`.

## Lösungsansatz

`lib/booking/storno.ts`:
- `STORNO_FRIST_STUNDEN = 2` (global; Lisas Richtwert, offiziell zu fixieren).
- `stornoGebuehrFaellig(start, befreit, jetzt)` — reine Regel, auch in der UI genutzt.
- `storniereBuchung(m, kt)` — sperrt Termin, storniert die aktive Buchung, setzt Flag,
  ruft danach `verarbeiteWarteliste(kt)` (nur bei künftigem, geplantem Termin).

UI: im Zustand „Gebucht ✓" ein **Stornieren**-Button; innerhalb der Frist Hinweis
„Stornieren (Gebühr)". Server Action `storniereBuchungAction`.

## Bewusst NICHT in v1 (spec §7 „Später")

- **Gebühren-Automatik** (Betrag berechnen/abbuchen). v1: nur Flag + manuelle
  Abwicklung durch Admin. `storno_gebuehr_betrag` bleibt vorerst leer — „Kurspreis"
  bei Flat-Tarifen ist offen (spec §8).

## Offen / Annahmen

- Frist 2 h global (vs. pro Kurstyp) — mit Kundin zu bestätigen (spec §8).
- „50 % Kurspreis"-Definition offen.
