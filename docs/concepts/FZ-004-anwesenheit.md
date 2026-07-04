# FZ-004 — Anwesenheitserfassung mit Zeitstempel

_Konzept / Plan. Quelle: `docs/spec.md §2` (Buchung-Workflow), §2b (Trainer-Rechte),
§7. Status: done (Engine). Trainer-UI folgt in FZ-005._

## Ziel

Der Trainer hält nach dem Kurs fest, wer da war: `anwesenheit` je Buchung wird auf
`anwesend | no_show | entschuldigt` (oder zurück auf `offen`) gesetzt, zusammen mit
einem **Erfassungs-Zeitstempel** (`anwesenheit_erfasst_am`). Grundlage für die
No-Show-Auswertung (BR6, FZ-013).

## Spec-Bezug

> §2 Buchung-Workflow: „nach Kursende `offen → anwesend | no_show | entschuldigt`
> (durch Trainer/Admin)". §2b Trainer: `Buchung: U (nur anwesenheit + trainer_notiz)`,
> **nur für Teilnehmer eigener Kurse**; keine fremden Kurstermine.

## Akzeptanzkriterien (alle per `npm run verify:fz004` grün)

- [x] Zuständiger Trainer setzt `anwesend`/`no_show`/`entschuldigt` → gespeichert,
      `anwesenheit_erfasst_am` gesetzt.
- [x] Korrektur auf `offen` → Zeitstempel wieder `null`.
- [x] Fremder Trainer (nicht Eigentümer des Termins) → `nicht_dein_kurs`, DB unverändert (§2b).
- [x] Kurs noch nicht begonnen (`start > jetzt`) → `zu_frueh`.
- [x] Kein aktiver (bestätigter) Teilnehmer → `keine_buchung`.
- [x] Unbekannter Kurstermin → `kurs_nicht_gefunden`.
- [x] Nachweis-Zeitstempel `buchungszeitpunkt` bleibt unverändert (NFR).

## Lösungsansatz

`lib/attendance/anwesenheit.ts`:
- `erfasseAnwesenheit(trainerId, kursterminId, mitgliedId, wert)` — prüft Existenz +
  Ownership (Termin gehört dem Trainer), Kursbeginn (`start <= jetzt`) und aktive
  Buchung, setzt dann `anwesenheit` + `anwesenheit_erfasst_am` (bei `offen` → `null`).
  Diskriminierte Rückgabe für die UI.

`app/trainer/actions.ts`:
- `erfasseAnwesenheitAction(kursterminId, mitgliedId, wert)` — Trainer-Identität aus
  der Session (`getBenutzer().trainerId`); Ownership erzwingt die Engine. Wird von der
  Trainer-Oberfläche in **FZ-005** aufgerufen.

Schema: neue Spalte `buchung.anwesenheit_erfasst_am` (nullable `timestamptz`),
Migration `drizzle/0002`.

## Bewusst NICHT in FZ-004

- **Trainer-Oberfläche** (eigener Kursplan, Teilnehmerliste, Abhak-UI) → **FZ-005**.
- **`trainer_notiz`** (z. B. „wirkte verletzt") → Should-have **FZ-012**.
- **No-Show-Auswertung/Admin-Hinweis ab Schwelle** → **FZ-013**.

## Offen / Annahmen

- „Nach Kursende" wird als „ab Kursbeginn" umgesetzt, da nur `kurstermin.start`
  (kein Kursende) modelliert ist. Falls ein echtes Kursende nötig wird: mit Kundin
  klären (spec §8).
- Admin darf laut §2b ebenfalls erfassen (volle Rechte). FZ-004 liefert die
  trainer-gebundene Engine; ein Admin-Pfad wird bei Bedarf ergänzt (nicht Teil dieses Items).
