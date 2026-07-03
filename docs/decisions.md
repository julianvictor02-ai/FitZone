# decisions.md — FitZone

_Chronologischer Log von Architektur- und Produktentscheidungen (neueste oben).
Format je Eintrag: Kontext → Entscheidung → verworfene Alternativen → Konsequenzen._

---

## 2026-07-03 — FZ-001: partieller Unique-Index + atomare Kapazitätsprüfung

**Kontext:** Umsetzung BR1 (Kursbuchung mit Auto-Bestätigung). Zwei Punkte:
(1) Der ursprüngliche `Unique(mitglied_id, kurstermin_id)` würde eine **Neubuchung
nach Storno** blockieren, weil die stornierte Zeile bestehen bleibt.
(2) BR1 verlangt eine race-condition-sichere Kapazitätsprüfung (letzter Platz).

### Entscheidung
- **Partieller Unique-Index** `uq_buchung_aktiv_mitglied_termin` auf
  `(mitglied_id, kurstermin_id) WHERE buchungsstatus='bestaetigt'` statt eines
  vollen Unique-Constraints. Erlaubt: max. eine **aktive** Buchung, beliebig viele
  stornierte Zeilen als Historie, Neubuchung nach Storno (jede mit eigenem,
  unveränderbarem `buchungszeitpunkt`).
- **Atomare Buchung** über Transaktion + `SELECT ... FOR UPDATE` auf die
  Kurstermin-Zeile: serialisiert konkurrierende Buchungen desselben Termins.
  Implementierung: `lib/booking/buchung.ts`.

### Alternativen verworfen
- Voller Unique-Constraint + Update der Storno-Zeile bei Neubuchung: würde den
  „unveränderbaren" Nachweis-Zeitstempel überschreiben (Konflikt mit NFR).
- `SERIALIZABLE`-Isolation statt Row-Lock: korrekt, aber mehr Retry-Handling nötig;
  Row-Lock ist hier einfacher und ausreichend.

### Konsequenzen
- Positiv: Buchungshistorie bleibt erhalten; Nachweis-Zeitstempel unangetastet; keine Überbuchung.
- Negativ/Risiko: Applikationslogik muss den Lock konsequent nutzen (nicht am Termin-Lock vorbei buchen). Migration `drizzle/0000` neu generiert (noch keine DB deployed).

---

## 2026-07-03 — Tech-Stack festgelegt: Next.js + Supabase

**Kontext:** Der Stack war bewusst offen (`architecture.md`). Anforderungen aus der Spec:
relationale DB mit Transaktionen (atomare Kapazitätsprüfung, BR1/BR2), RBAC für 3 Rollen
(Admin/Trainer/Mitglied), Background-Jobs für das 30-Min-Nachrück-Fenster (BR2),
Benachrichtigungen (BR8) und unveränderbare Zeitstempel (NFR). Solo-Projekt, MVP, „Vibe Coding".

### Entscheidung
- **Sprache/Framework:** TypeScript, **Next.js** (App Router) für Frontend + Backend (Route Handlers / Server Actions).
- **Datenbank:** **PostgreSQL via Supabase** — Transaktionen + Constraints (`Unique(mitglied_id, kurstermin_id)`, atomare Kapazitätsprüfung).
- **Auth/RBAC:** **Supabase Auth + Row Level Security** — Rollen Admin/Trainer/Mitglied; Sichtbarkeitsregeln (nur eigene Daten, nur Zahl freier Plätze) DB-seitig via RLS erzwungen.
- **ORM:** **Drizzle** (typisiert, leichtgewichtig). Prisma als Alternative verworfen (schwerer, aber austauschbar — geringe Tragweite).
- **Jobs/Timer:** Supabase Edge Functions bzw. `pg_cron` für das 30-Min-Fenster.
- **Mail/Benachrichtigung:** Resend (Kanal endgültig offen, siehe `spec.md §8`).
- **Deployment:** Vercel.

### Alternativen verworfen
- **Next.js + eigene/selbst gehostete Postgres (Auth.js):** mehr Kontrolle, aber deutlich mehr Eigenbau (Auth, Jobs, RLS) — für Solo-MVP unnötig.
- **Python + FastAPI:** starke Backend-Trennung, aber zwei getrennte FE/BE-Teile = mehr Overhead; kein Vorteil gegenüber integriertem Next.js hier.

### Konsequenzen
- Positiv: Auth, DB und RLS gebündelt → schneller MVP; RBAC/Datenschutz-Regeln direkt in der DB; wenig Infrastruktur-Setup solo.
- Negativ/Risiko: Plattformbindung an Supabase; RLS-Regeln müssen sorgfältig getestet werden (Cross-Member-/Cross-Trainer-Zugriff); atomare Kapazitätsprüfung explizit per Transaktion/Constraint absichern, nicht dem ORM überlassen.

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
