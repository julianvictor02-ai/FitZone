# FZ-005 — Trainer-Login: eigener Kursplan + Anwesenheit abhaken

_Konzept / Plan. Quelle: `docs/spec.md §3` (Trainer-Rolle), §2b, §7, §11. Status: done.
Baut auf der FZ-004-Engine auf._

## Ziel

Ein angemeldeter Trainer sieht **nur seine eigenen** Kurstermine mit Teilnehmerliste und
hakt die Anwesenheit ab. Die eigentliche Erfassung + Validierung liefert FZ-004
(`erfasseAnwesenheit`); FZ-005 ist die Oberfläche + die Sichtbarkeits-Durchsetzung.

## Spec-Bezug

> §2b Trainer: `Kurstermin: R (nur eigene)`, `Buchung: R (Teilnehmer eigener Kurse),
> U (nur anwesenheit + trainer_notiz)`. Fremde Kurstermine: kein Zugriff. §11:
> „Trainer-Ansicht: eigener Kursplan, Teilnehmerliste, Anwesenheit-Checkliste".

## Akzeptanzkriterien (Isolation per `npm run verify:fz005`, 8/8; Rest per build/manuell)

- [x] Nur eigene Termine sichtbar; fremde Kurse **nicht** (§2b).
- [x] Eigener abgesagter Kurs erscheint nicht.
- [x] Teilnehmer eigener Kurse sichtbar (Namen zulässig); fremde Teilnehmer nicht.
- [x] Abhaken erst ab Kursbeginn (`start <= jetzt`), sonst UI deaktiviert (Engine: `zu_frueh`).
- [x] `/trainer` nur für Rolle `trainer` (requireRolle), sonst Redirect.
- [x] Klick auf Status setzt via `erfasseAnwesenheitAction`; erneuter Klick = zurück auf `offen`.

## Lösungsansatz

- `app/trainer/page.tsx` (RSC): `requireRolle("trainer")`, Query hart auf
  `trainer_id = me.trainerId` + `status != abgesagt`, Teilnehmer je Termin (bestätigte
  Buchungen) mit aktueller Anwesenheit. Sichtbarkeit **app-seitig** erzwungen (RLS später).
- `app/trainer/AnwesenheitAktion.tsx` (Client): drei Buttons (Anwesend/No-Show/
  Entschuldigt), aktive Auswahl hervorgehoben; Toggle setzt zurück auf `offen`. Deaktiviert
  vor Kursbeginn.
- `app/trainer/actions.ts` (aus FZ-004): löst Trainer-Identität aus der Session.
- `app/page.tsx`: Navigationslink „Mein Kursplan" für Rolle `trainer`.
- `scripts/bootstrap.ts`: verknüpft (best effort) das Trainer-Auth-Konto mit Rolle
  `trainer` + legt einen vergangenen Demo-Kurs mit Teilnehmer an.

## Bewusst NICHT in FZ-005

- **`trainer_notiz`** (Notizfeld) → Should-have **FZ-012**.
- **No-Show-Auswertung/Admin-Hinweis** → **FZ-013**.
- **Admin-Erfassungspfad** (§2b Admin volle Rechte) → bei Bedarf, nicht Teil dieses Items.

## Offen / Annahmen

- Browser-End-to-End steht aus, bis ein Trainer-Auth-Konto existiert (Provisionierung
  offen, wie FZ-006). Danach `bootstrap` + Login als `marie@fitzone.test`.
- „Kursplan" zeigt aktuell alle eigenen, nicht abgesagten Termine (jüngste zuerst); ob
  ein Zeitfilter/Pagination nötig wird, ist v1 offen.
