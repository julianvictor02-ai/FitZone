# modus-operandi.md — FitZone (Solo-Variante)

_Projektspezifische Arbeitsweise nach [jacekzawisza/modus-operandi](https://github.com/jacekzawisza/modus-operandi).
Dies ist die **Solo-Variante**: kein Team-Overhead._

---

## Prinzip

**Artefakte > Meetings.** Alles Relevante liegt als AI-lesbares Markdown im Repo —
eine einzige Quelle der Wahrheit. KI (Claude) liest die Artefakte und arbeitet aktiv mit.

## Artefakte in diesem Projekt

| Datei | Zweck |
|-------|-------|
| `CLAUDE.md` (Root) | KI-Briefing (< 200 Zeilen), Einstieg + Verweise |
| `AGENTS.md` (Root) | Zeiger auf `CLAUDE.md` für Tools, die diese Konvention erwarten |
| `docs/spec.md` | Anforderungen: WAS + WARUM (**ersetzt die PRD**) |
| `docs/backlog.md` | Feature-Registry mit stabilen IDs `FZ-NNN` + Status |
| `docs/architecture.md` | Stack, Datenmodell, kritische Validierungen |
| `docs/decisions.md` | Chronologischer Entscheidungs-Log |
| `docs/modus-operandi.md` | Diese Datei |

## Bewusst weggelassen (Solo)

`meetings/`, `results/`, `docs/team/` und `INBOX.md` entfallen — sie lösen Team-
und Parallelbearbeitungs-Probleme, die hier nicht existieren. Kommen später weitere
Personen dazu, nach der Team-Variante der Methodik nachrüsten.

Kundenfeedback (z. B. neue Gespräche mit Lisa) fließt direkt in `docs/spec.md`
(Fakten/offene Fragen) und `docs/decisions.md` (getroffene Entscheidungen).

## Session-Loop (5 Schritte)

1. **Kontext laden** — `CLAUDE.md` → `spec.md` → `backlog.md` → `architecture.md`.
2. **Task definieren** — konkretes Feature (`FZ-NNN`) mit Akzeptanzkriterien (aus Business Rules `spec.md §4`).
3. **Plan zuerst** — Implementierungsplan vorschlagen, *bevor* Code entsteht. Erst prüfen, dann bauen.
4. **Implementieren + Testen** — Code, Test, iterieren. Bei Bugs: reproduzierender Test → Fix bis grün.
5. **Session schließen** —
   - `backlog.md`: Status des Features aktualisieren (`in-progress`/`done`).
   - `decisions.md`: Eintrag, falls architektur-/produktrelevant entschieden.
   - `architecture.md`/`CLAUDE.md`: bei neuen Konventionen ergänzen.
   - Sauberer Commit: `feat: FZ-NNN <Name>`.

**Kernbewegung:** erst planen, dann coden — verhindert, das falsche Problem zu lösen.

## Feature-Lebenszyklus

```
spec.md (WARUM/WAS)
  → architecture.md (WIE)
  → backlog.md (WELCHE Features, Status)
  → Implementierung (Code + decisions.md-Einträge)
```

Neue Feature-Idee → nächste freie `FZ-NNN` in `backlog.md` (`hypo`) → nach Kunden-
Bestätigung `validated` → beim Bauen `in-progress` → fertig `done`. Verworfen = `killed`
(ID bleibt, Begründung in `decisions.md`).
