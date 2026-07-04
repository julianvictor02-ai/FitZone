# FZ-007 — Mitglieder-Selbstansicht (read-only Dashboard)

_Konzept / Plan. Quelle: `docs/spec.md §2b`, §7, §11. Status: done._

## Ziel

Das angemeldete Mitglied sieht **nur eigene** Daten an einer Stelle: Stammdaten (Tarif,
Status, `mitgliedschaft_bis`), eigene Buchungen inkl. Historie und den aktiven
Wartelisten-Status. **Nur lesend** — Tarif/Status/Pausieren ändert der Admin (FZ-017 killed).

## Spec-Bezug

> §2b Mitglied: `Mitglied (eigener Datensatz): R (Tarif, Status, mitgliedschaft_bis,
> eigene Buchungen). Kein Ändern/Pausieren/Tarifwechsel`. §11: „Mein Bereich: Tarif,
> mitgliedschaft_bis, eigene Buchungen/Historie, Wartelisten-Status".

## Akzeptanzkriterien (Isolation per `npm run verify:fz007`, 9/9; Rest per build)

- [x] Stammdaten korrekt (Name, Tarif, Status, `mitgliedschaft_bis` bzw. „unbefristet").
- [x] Nur eigene Buchungen; fremde nicht (§2b) — inkl. Historie (bestätigt + storniert).
- [x] Storno-Buchung mit `stornozeitpunkt`/Gebühr-Hinweis sichtbar.
- [x] Anwesenheit (aus FZ-004) je Buchung sichtbar, sofern erfasst.
- [x] Aktiver Wartelisten-Status mit korrekter FIFO-Position (A=1 vor B=2, BR3).
- [x] `/mein-bereich` nur für Rolle `mitglied` (requireRolle); keine Mutationen.

## Lösungsansatz

- `app/mein-bereich/page.tsx` (RSC): `requireRolle("mitglied")`, drei Queries hart auf
  `mitglied_id = me.mitgliedId` (Stammdaten+Tarif, Buchungen+Kurstermin, aktive
  Wartelisteneinträge). FIFO-Position dynamisch aus `zeitstempel` (wie Kursliste/FZ-002).
- `app/page.tsx`: Navigationslink „Mein Bereich" für Rolle `mitglied`.

## Bewusst NICHT in FZ-007

- **Jede Bearbeitung** (Tarif/Status/Pausieren) → Admin (FZ-006), Selbst-Änderung dauerhaft
  ausgeschlossen (FZ-017 killed).
- **Storno/Buchen/Warteliste-Aktionen** → bleiben auf `/kurse` (FZ-001–003); das Dashboard
  ist reine Übersicht.

## Offen / Annahmen

- Ein Zeitfilter/Pagination der Buchungshistorie ist v1 nicht nötig (kleine Datenmengen).
- Sichtbarkeit app-seitig; RLS als spätere Defense-in-Depth (wie FZ-005/006).
