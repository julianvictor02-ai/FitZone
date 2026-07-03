# FZ-001 — Kursbuchung mit Auto-Bestätigung

_Konzept / Plan. Quelle: `docs/spec.md §4 BR1`, §10/§11. Status: in-progress._

## Ziel

Ein Mitglied bucht einen Kurstermin selbst; bei freiem Platz wird die Buchung
**ohne Admin automatisch bestätigt** und mit einem Nachweis-Zeitstempel gespeichert.

## Business Rule (BR1)

> Wenn ein Mitglied einen Kurstermin bucht und `bestätigte Buchungen < kapazitaet`,
> dann Buchung mit `buchungsstatus=bestaetigt` + `buchungszeitpunkt`, automatisch
> bestätigt (ohne Admin).

## Akzeptanzkriterien

- [ ] Bei freiem Platz wird die Buchung ohne manuelles Zutun bestätigt (`buchungsstatus=bestaetigt`).
- [ ] `buchungszeitpunkt` wird gesetzt und ist abrufbar (Nachweis, „nicht verhandelbar" — NFR).
- [ ] Bei `count(bestätigt) >= kapazitaet` wird **nicht** gebucht → Ergebnis `voll` (Warteliste = FZ-002).
- [ ] Doppelbuchung wird verhindert: existiert bereits eine aktive Buchung → `bereits_gebucht`.
- [ ] Abgesagter/verschobener/fehlender Termin ist nicht buchbar → `kurs_nicht_buchbar`.
- [ ] **Atomar:** Buchen zwei Mitglieder gleichzeitig den letzten Platz, gewinnt genau eines; keine Überbuchung.

## Lösungsansatz

Kernfunktion `bucheKurstermin(mitgliedId, kursterminId)` in `lib/booking/buchung.ts`:

1. **Transaktion starten.**
2. Kurstermin-Zeile per `SELECT ... FOR UPDATE` **sperren** → alle konkurrierenden
   Buchungen desselben Termins werden serialisiert (löst die Race Condition von BR1).
3. Termin-Status prüfen (`geplant`? sonst `kurs_nicht_buchbar`).
4. Doppelbuchung prüfen (aktive `bestaetigt`-Buchung vorhanden? → `bereits_gebucht`).
5. `count(bestätigt)` gegen `kapazitaet` prüfen (`>=` → `voll`).
6. Buchung mit `buchungsstatus=bestaetigt` einfügen; `buchungszeitpunkt` via `defaultNow()`.

**Backstop:** partieller Unique-Index `uq_buchung_aktiv_mitglied_termin`
(nur `WHERE buchungsstatus='bestaetigt'`) verhindert doppelte aktive Buchungen auch
bei Programmierfehlern und erlaubt zugleich Neubuchung nach Storno (Historie bleibt).

Integration: Server Action `bucheKursterminAction` (`app/kurse/actions.ts`) leitet das
angemeldete Supabase-Konto → Mitglied ab und ruft die Kernfunktion.

## Bewusst NICHT in FZ-001 (andere Features)

- Warteliste / Nachrücken bei `voll` → **FZ-002**.
- Monatslimit Basic (5/Monat) → **FZ-010**.
- Tarif-/Content-Zugriffsprüfung → **FZ-011**.
- Selbst-Storno → **FZ-003**.
- Login/Auth-Flow + Mitglieder-Seed → **FZ-006** (Action ist vorbereitet, aber erst dann produktiv).
- Buchungs-UI (Terminliste + Button) → folgt, sobald Auth + Seed-Daten stehen.

## Verifikation (manuell, sobald Supabase steht)

1. `.env.local` mit Supabase-Werten füllen, `npm run db:push` (Schema anlegen).
2. Testdaten: 1 Tarif, 1 Mitglied, 1 Trainer, 1 Kurstyp, 1 Kurstermin mit `kapazitaet=1`.
3. `bucheKurstermin(m, t)` → `bestaetigt` + Zeitstempel gesetzt.
4. Erneuter Aufruf gleiches Mitglied → `bereits_gebucht`.
5. Zweites Mitglied auf denselben (vollen) Termin → `voll`.
6. Nebenläufigkeit: zwei parallele Aufrufe auf `kapazitaet=1` → genau ein `bestaetigt`.
