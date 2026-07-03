# CLAUDE.md — FitZone (Smart Applications)

## Projekt
Buchungs- und Verwaltungs-App für das Fitness-Studio **FitZone** (Berlin, Inhaberin
Lisa Sommer). Ersetzt die manuelle Kursorganisation (WhatsApp/Instagram/Excel) durch
Selbst-Buchung mit Auto-Bestätigung, FIFO-Warteliste mit Nachrücken, Selbst-Storno,
Anwesenheitserfassung und rollenbasierte Rechte (Admin/Trainer/Mitglied).

## Deadline
**26.07.2026** — Abgabe im Modul „Smart Applications" (BWL 8).

## Setup
Solo-Projekt. Keine `meetings/`, `results/`, `team/`, `INBOX.md` — bewusst weggelassen (siehe `docs/modus-operandi.md`).

## Was bauen wir?
→ Lies **docs/spec.md** (Anforderungen: WAS + WARUM; ersetzt in diesem Projekt die PRD).
→ Lies **docs/backlog.md** (Feature-IDs `FZ-NNN` + Status).

## Tech-Stack + Standards
→ Lies **docs/architecture.md** (Datenmodell + Stack stehen fest: Next.js + Supabase, TypeScript, Drizzle).

## Architektur- & Produkt-Entscheidungen
→ Lies **docs/decisions.md** (u. a. aufgelöste Widersprüche W1–W4 aus der Spec).

## Arbeitsweise
→ Lies **docs/modus-operandi.md** (Solo-Variante: Session-Loop, Artefakt-Pflege).

## Coding-Prinzipien (Karpathy-Regeln)

Vier universelle Regeln für jede Code-Session. Quelle: Andrej Karpathy via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills).

**1. Think Before Coding.** Annahmen explizit machen. Bei Mehrdeutigkeit Interpretationen aufzeigen statt zu raten. Wenn etwas unklar ist: stoppen und fragen. Wenn ein einfacherer Ansatz existiert: sagen.

**2. Simplicity First.** Minimum Code, der das Problem löst. Keine Features über das Gefragte hinaus. Keine Abstraktionen für Single-Use-Code. Keine "Flexibility", die nicht angefordert wurde. Kein Error-Handling für unmögliche Fälle. Wenn 200 Zeilen auch in 50 gehen: 50 schreiben.

**3. Surgical Changes.** Nur das anfassen, was nötig ist. Kein Drive-by-Refactoring von Architektur. Existierenden Stil matchen. **Erlaubt im Vorbeigehen:** kleine Style-Angleichungen, offensichtliche Sicherheits-/Effizienzfixes, Aufräumen eigener Orphans. **Nicht erlaubt:** unaufgeforderte Architektur-Eingriffe oder neue Abstraktionen. Im Zweifel: erwähnen statt machen.

**4. Goal-Driven Execution.** Erfolgskriterien vor Implementierung definieren. Bei Bugs: Test, der den Bug reproduziert, dann Fix bis Test grün. Bei Features: Akzeptanzkriterien als Checkliste. Bei Multi-Step-Tasks: Plan mit "Schritt → Verifikation" pro Punkt, dann loopen bis verifiziert.

**Trade-off:** Sorgfalt vor Geschwindigkeit. Bei Trivialitäten (Typo, Einzeiler) Urteilsvermögen nutzen.

## Coding-Konventionen
- Deutsche Domänen-Begriffe und UI-Texte (Mitglied, Kurstermin, Warteliste …), konsistent mit `docs/spec.md`.
- Feature-Arbeit immer per `FZ-NNN` referenzieren (Commit: `feat: FZ-NNN <Name>`).
- Business Rules BR1–BR9 aus `docs/spec.md §4` sind die Quelle der Wahrheit für Validierungen.

## Gotchas / Bekannte Fallen
- **Kapazitätsprüfung server-seitig und atomar** — Race Condition beim gleichzeitigen Buchen des letzten Platzes (BR1).
- **Warteliste strikt FIFO** über `zeitstempel`; Premium darf **nicht** vordrängeln (BR3). 30-Min-Fenster = Server-Timer/Job (BR2).
- **`buchung.buchungszeitpunkt` ist unveränderbar** — Nachweis-Zeitstempel, „nicht verhandelbar" (NFR).
- **Sichtbarkeit**: Mitglied sieht nur eigene Daten + nur die *Zahl* freier Plätze (keine fremden Namen); Trainer sieht nur eigene Kurse. Server-seitig erzwingen.
