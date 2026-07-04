# backlog.md — FitZone

_Stand: 2026-07-04_

_Stabile Feature-IDs. Nicht umnummerieren. Killed-IDs bleiben killed._

---

## Konvention

- **ID-Schema:** `FZ-NNN` (Prefix `FZ` = FitZone, fest)
- **Nummerierung:** fortlaufend, **nie wiederverwendet** (auch nicht bei `killed`)
- **Referenzierung:** In Commits, Konzepten, `decisions.md` immer per ID.
- **Quelle:** Verweist auf `docs/spec.md` (ersetzt die PRD als Anforderungsquelle).

## Status-Werte

| Status | Bedeutung |
|--------|-----------|
| `hypo` | Idee/Kandidat, für v1 noch nicht entschieden |
| `validated` | Mit Kundin (Lisa) im Interview bestätigt, aber noch kein Code |
| `in-progress` | Aktuell in Arbeit |
| `done` | Implementiert, im Commit referenziert |
| `killed` | Verworfen — Begründung in `decisions.md` |

## Features

| ID | Name | Phase | Status | Quelle | Notiz |
|----|------|-------|--------|--------|-------|
| FZ-001 | Online-Kursbuchung mit Auto-Bestätigung | 1 | done | spec.md §4 BR1, §7 | E2E gegen Supabase verifiziert: verify:fz001 (5/5 BR1) + verify-flow (Login→/kurse→Buchung→Anzeige) gegen laufende App. |
| FZ-002 | Warteliste FIFO + Nachrücken + 30-Min-Fenster + harte Obergrenze | 1 | done | spec.md §4 BR2/BR3 | Engine + UI + Cron. Verifiziert (verify:fz002, alle Kriterien). Live-Trigger "Platz frei" durch FZ-003 (Storno) angebunden. Obergrenze=5/Termin (Annahme). |
| FZ-003 | Selbst-Stornierung (Frist + Gebühren-Flag, keine Abbuchung) | 1 | done | spec.md §4 BR5 | lib/booking/storno.ts + UI. Frist 2h, Premium befreit, Flag statt Abbuchung. Löst Nachrücken aus. Verifiziert (verify:fz003). |
| FZ-004 | Anwesenheitserfassung mit Zeitstempel | 1 | done | spec.md §2 (Buchung), §7 | Engine `lib/attendance/anwesenheit.ts` + Action + Spalte `anwesenheit_erfasst_am` (Migration 0002). Trainer-Ownership (§2b), Vor-Kurs-Sperre, NFR-Zeitstempel. Verifiziert (verify:fz004, 10/10) gegen Supabase. Trainer-UI = FZ-005. |
| FZ-005 | Trainer-Login: eigener Kursplan + Anwesenheit abhaken | 1 | done | spec.md §3, §7 | `app/trainer` (Page + AnwesenheitAktion) auf FZ-004-Engine. Strikt eigene Termine/Teilnehmer (§2b), Abhaken ab Kursbeginn. Isolation verifiziert (verify:fz005, 8/8). Trainer-Login-Provisionierung in bootstrap ergänzt (best effort). |
| FZ-006 | Mitgliederstammdaten (Tarif/Status), admin-gepflegt | 1 | done | spec.md §2, §7 | Auth/Rollen (benutzer) + Guards + Admin-CRUD. Guards + Rollenauflösung live verifiziert (member-Flow); Admin-CRUD nutzt denselben Pfad. Follow-up: Login-Provisionierung + RLS (nicht Teil dieses Items). |
| FZ-007 | Mitglieder-Selbstansicht (read-only Dashboard) | 1 | done | spec.md §7, §11 | `app/mein-bereich` (RSC, read-only): Stammdaten (Tarif/Status/mitgliedschaft_bis), eigene Buchungen/Historie, Wartelisten-Status + FIFO-Position. Strikt eigene Daten (§2b), keine Mutationen. Isolation verifiziert (verify:fz007, 9/9). |
| FZ-008 | Buchungsnachweis/Zeitstempel für alle Vorgänge | 1 | done | spec.md §6 (NFR) | Konsolidiertes Audit-Log `lib/audit/nachweis.ts` (`ladeNachweisEreignisse`) aus den vorhandenen, unveränderbaren Zeitstempeln aller Vorgänge (gebucht/storniert/Anwesenheit/Warteliste/Nachrücken); Admin-Ansicht `app/admin/nachweis` (read-only, chronologisch). Reine Lese-Aggregation, kein Schema-Change. Verifiziert (verify:fz008, 12/12). DB-seitige Immutabilität von `buchungszeitpunkt` als spätere Härtung offen (wie RLS). |
| FZ-009 | Auto-Benachrichtigung bei Kursausfall/-verschiebung | 1 | done | spec.md §4 BR8 | Engine `lib/kurstermin/status.ts` (`sageKursterminAb`/`verschiebeKurstermin`, atomar, Übergänge §2) benachrichtigt alle Betroffenen (Buchung + aktive Warteliste). Admin-UI `app/admin/kurstermine`. Mein-Bereich zeigt Abgesagt/Verschoben. Kanal weiterhin Stub (`lib/notify.ts`, spec §8). Verifiziert (verify:fz009, 11/11). |
| FZ-010 | Buchungslimits pro Tarif (Basic 5/Monat, Plus/Premium unbegrenzt) | 1 | done | spec.md §4 BR4, §5 W3/W4 | `lib/booking/limit.ts`, erzwungen in Direktbuchung + Nachrücken. Basic=5 aktive Buchungen/Kalendermonat (nach Kurstermin-Datum), Storno gibt Slot frei; Plus/Premium=null. Verifiziert (verify:fz010, 9/9); keine Regression fz001–003. Kalendermonat vs. rollierend weiter mit Kundin zu bestätigen. |
| FZ-011 | Content-Zugriff nach Tarif (On-Demand/Livestream) | 1 | done | spec.md §4 BR7 | On-Demand-Teil: `lib/content/zugriff.ts` + `app/videos` (tarif-gefiltert, Basic sieht keine). Verifiziert (verify:fz011, 9/9). **Livestream-Buchungs-Gate für Basic vertagt** (spec §8 offen) — siehe decisions.md. |
| FZ-012 | Trainer-Notizen zu Teilnehmern | 2 | done | spec.md §7 (Should-have) | Engine `lib/trainer/notiz.ts` (`setzeTrainerNotiz`) auf vorhandener Spalte `buchung.trainer_notiz`; Trainer-Ownership + aktive Buchung (§2b), leere Eingabe löscht (null), keine Zeitgrenze. UI: `app/trainer/TrainerNotiz.tsx` je Teilnehmer. Kein Schema-Change. Verifiziert (verify:fz012, 9/9). |
| FZ-013 | No-Show-Auswertung mit Admin-Hinweis ab Schwelle | 2 | done | spec.md §4 BR6, §7 | Engine `lib/attendance/noshow.ts` (`ladeNoShowAuswertung`): zählt `no_show` je Mitglied im gleitenden Fenster (nach Kurs-Datum), Hinweis ab Schwelle. Admin-Report `app/admin/no-show` (markiert ≥ Schwelle, zeigt Tarif). **Keine Auto-Sperre** (BR6/W1); Premium wird getrackt. Schwelle=3 / Fenster=90 Tage als Default (spec §8 offen, mit Kundin bestätigen). Reine Lese-Aggregation. Verifiziert (verify:fz013, 9/9). |
| FZ-014 | Early-Access-Buchungsfenster für Premium | 2 | hypo | spec.md §4 BR9, §5 W2 | Nur Idee von Lisa, nicht entschieden. |
| FZ-015 | On-Demand-Video-Feinsteuerung | 3 | hypo | spec.md §7 (Später) | Vimeo-Workaround reicht vorerst. |
| FZ-016 | Stornogebühren-Automatik (Berechnung/Abbuchung) | 3 | hypo | spec.md §7 (Später) | v1 nur Flag + manuelle Abwicklung. |
| FZ-017 | Selbstständiger Tarifwechsel/Pausieren durch Mitglieder | — | killed | spec.md §7 | Siehe decisions.md 2026-07-03: bewusst dauerhaft Admin-Sache. |

> **Phase**: 1 = MVP (Must-have), 2 = Should-have, 3 = Später/Offen. Killed → `—`.

---

## Workflow

**Feature wird gebaut:** Status → `in-progress`, Branch-Name in Notiz. Commit: `feat: FZ-NNN <Name>`.
**Feature fertig:** Status → `done`, Commit-Hash + Version in Notiz.
**Feature verworfen:** Status → `killed`, Eintrag in `decisions.md`. ID bleibt stehen — NICHT löschen/wiederverwenden.

---

## Verhältnis zur Spec

`docs/spec.md` beschreibt Kontext, Entitäten, Business Rules (BR1–BR9) und Prioritäten
(§7). Die konkrete, operativ gepflegte Feature-Liste mit Status steht **hier** — keine
Doppelpflege. Offene Fragen zu einzelnen Features siehe `spec.md §8`.
