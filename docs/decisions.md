# decisions.md — FitZone

_Chronologischer Log von Architektur- und Produktentscheidungen (neueste oben).
Format je Eintrag: Kontext → Entscheidung → verworfene Alternativen → Konsequenzen._

---

## 2026-07-03 — Projekt nach Modus Operandi (Solo) aufgesetzt

**Kontext:** Doku-Struktur für die FitZone-App nach der Methodik
[jacekzawisza/modus-operandi](https://github.com/jacekzawisza/modus-operandi) benötigt.
Es ist ein Solo-Projekt.

### Entscheidung
- Artefakt-Struktur angelegt: `CLAUDE.md` (+ Zeiger `AGENTS.md`), `docs/spec.md`,
  `docs/backlog.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/modus-operandi.md`.
- **`docs/spec.md` übernimmt die Rolle der PRD** — es gibt keine `prd.md`.
- `docs/spec.md` = umbenannte/verschobene `Fit_Zone_SPEC.md`.

### Alternativen verworfen
- Volle Team-Struktur (`meetings/`, `results/`, `team/`, `INBOX.md`): unnötig für Solo.
- Separate `prd.md` neben der Spec: erzeugt Doppelpflege; Spec ist bereits vollständig.

### Konsequenzen
- Positiv: schlanke, AI-lesbare Doku ohne Overhead.
- Negativ/Risiko: Kein Meeting-Log — künftige Kundengespräche direkt in `spec.md`/`decisions.md` einpflegen.

---

## 2026-07-03 — Aufgelöste Widersprüche aus der Spec als v1-Arbeitsannahmen fixiert

**Kontext:** Die Spec (§5) dokumentiert vier Widersprüche aus dem Kundeninterview, die Lisa selbst aufgelöst hat. Diese als verbindliche v1-Regeln festhalten.

### Entscheidung
- **W1:** Premium bleibt limit-/gebührenfrei; zusätzlich **No-Show-Tracking + Admin-Hinweis**, aber **keine** Auto-Sperre (BR6).
- **W2:** Wartelisten-Obergrenze und FIFO gelten **einheitlich**; Premium-Vorteil ggf. nur über früheres Buchungsfenster, **nicht** durch Vordrängeln (BR3).
- **W3:** Basic = **5 Buchungen/Monat (hart)**; „6/Woche" war illustrativ (BR4).
- **W4:** Plus = **kein festes Buchungslimit**; Steuerung über No-Show-Tracking (BR4/BR6).

### Konsequenzen
- Positiv: klare, testbare Regeln für Implementierung.
- Negativ/Risiko: Zahlwerte (Obergrenze, Monatsdefinition, No-Show-Schwelle) noch offen — siehe `spec.md §8`, vor Bau bestätigen.

---

## 2026-07-03 — FZ-017 (Selbst-Tarifwechsel/Pausieren) verworfen

**Kontext:** Möglichkeit, dass Mitglieder Tarif selbst wechseln/pausieren.

### Entscheidung
`killed`. Tarifwechsel und Pausieren bleiben **bewusst dauerhaft Admin-Aufgabe**
(`spec.md §7`, Rohprotokoll).

### Konsequenzen
- Positiv: einfachere Rechte-/Abrechnungslogik in v1.
- Negativ: keine — bewusst außerhalb des Scopes.
