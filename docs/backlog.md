# backlog.md — FitZone

_Stand: 2026-07-03_

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
| FZ-001 | Online-Kursbuchung mit Auto-Bestätigung | 1 | validated | spec.md §4 BR1, §7 | Wichtigster Flow. Kapazitätsprüfung atomar. |
| FZ-002 | Warteliste FIFO + Nachrücken + 30-Min-Fenster + harte Obergrenze | 1 | validated | spec.md §4 BR2/BR3 | Muss zeitgleich mit FZ-001 stehen. Obergrenze-Zahlwert offen. |
| FZ-003 | Selbst-Stornierung (Frist + Gebühren-Flag, keine Abbuchung) | 1 | validated | spec.md §4 BR5 | v1 nur `stornozeitpunkt` + Flag. |
| FZ-004 | Anwesenheitserfassung mit Zeitstempel | 1 | validated | spec.md §2 (Buchung), §7 | Enum offen/anwesend/no_show/entschuldigt. |
| FZ-005 | Trainer-Login: eigener Kursplan + Anwesenheit abhaken | 1 | validated | spec.md §3, §7 | Nur eigene Termine sichtbar. |
| FZ-006 | Mitgliederstammdaten (Tarif/Status), admin-gepflegt | 1 | validated | spec.md §2, §7 | Basis für alles Weitere. |
| FZ-007 | Mitglieder-Selbstansicht (read-only Dashboard) | 1 | validated | spec.md §7, §11 | Tarif, mitgliedschaft_bis, eigene Buchungen. |
| FZ-008 | Buchungsnachweis/Zeitstempel für alle Vorgänge | 1 | validated | spec.md §6 (NFR) | „Nicht verhandelbar", auditierbar. |
| FZ-009 | Auto-Benachrichtigung bei Kursausfall/-verschiebung | 1 | validated | spec.md §4 BR8 | Kanal (Push/E-Mail/SMS) offen. |
| FZ-010 | Buchungslimits pro Tarif (Basic 5/Monat, Plus/Premium unbegrenzt) | 1 | validated | spec.md §4 BR4, §5 W3/W4 | Kalendermonat vs. rollierend offen. |
| FZ-011 | Content-Zugriff nach Tarif (On-Demand/Livestream) | 1 | validated | spec.md §4 BR7 | Basic-Livestream unklar. |
| FZ-012 | Trainer-Notizen zu Teilnehmern | 2 | validated | spec.md §7 (Should-have) | z. B. „wirkte verletzt". |
| FZ-013 | No-Show-Auswertung mit Admin-Hinweis ab Schwelle | 2 | validated | spec.md §4 BR6, §7 | Schwelle (3–4?) + Zeitraum offen. Keine Auto-Sperre. |
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
