# decisions.md — FitZone

_Chronologischer Log von Architektur- und Produktentscheidungen (neueste oben).
Format je Eintrag: Kontext → Entscheidung → verworfene Alternativen → Konsequenzen._

---

## 2026-07-03 — FZ-006: Identitätsmodell (benutzer) + app-seitige Autorisierung

**Kontext:** FZ-006 (Mitgliederstammdaten, admin-gepflegt) braucht eine Auth-/Rollen-
Grundlage. Zwei Fragen: (1) Wie werden Rollen und die Verknüpfung Auth↔Domäne
modelliert? (2) Wo wird die Autorisierung erzwungen?

### Entscheidung
- **`benutzer`-Tabelle** als zentrales Identitätsmodell: `benutzer_id` = Supabase
  `auth.users.id`, `rolle`-Enum (`admin`/`trainer`/`mitglied`), optionale FKs
  `mitglied_id` / `trainer_id`. Admin hat keine der beiden FKs.
- **Autorisierung primär app-seitig** über Guards in Server Components / Server
  Actions (`requireRolle` in `lib/auth/benutzer.ts`). Grund: Runtime-Queries laufen
  über Drizzle mit einer Postgres-**Service-Connection**, die RLS umgeht.
- **RLS** wird als späteres Defense-in-Depth ergänzt (eigener Folge-Task), nicht als
  primäre Durchsetzung. Korrigiert die frühere Notiz „RBAC via RLS" in architecture.md.

### Alternativen verworfen
- Rolle als Spalte auf `mitglied`/`trainer`: kein Platz für Admin (hat keinen
  Domänen-Datensatz); Auth↔Domäne bliebe unklar.
- Rollen nur in Supabase `app_metadata` (JWT-Claims): schwerer testbar/joinbar,
  keine referenzielle Integrität zu mitglied/trainer.
- Datenzugriff komplett über den Supabase-Client (RLS-durchgesetzt) statt Drizzle:
  unvereinbar mit der transaktionalen Buchungslogik (FOR-UPDATE, FZ-001).

### Konsequenzen
- Positiv: klares, joinbares Identitätsmodell; eine Stelle für Rollenprüfungen;
  kompatibel mit der Drizzle-Transaktionslogik.
- Negativ/Risiko: Autorisierung muss in **jeder** Server Action/Route konsequent
  aufgerufen werden (kein DB-Netz darunter, bis RLS ergänzt ist). `benutzer_id` muss
  beim Anlegen exakt der auth.users.id entsprechen. Mitglieder-Login-Provisionierung
  (Konto ↔ mitglied ↔ benutzer) ist noch offen.

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

## 2026-07-03 — FZ-003: Storno-Frist und Gebühren-Modell (v1)

**Kontext:** Umsetzung BR5. Offen laut Spec: 2 h ist Lisas „gedachte" Grenze (nicht
fixiert), global vs. pro Kurstyp; „Kurspreis" bei Flat-Tarifen; Auto-Abbuchung.

### Entscheidung
- **`STORNO_FRIST_STUNDEN = 2`, global** (Annahme aus Lisas Richtwert), zentrale Konstante.
- **Gebühr nur als Flag** `storno_gebuehr_faellig` (kein Betrag, keine Abbuchung in v1;
  Admin wickelt manuell ab). `storno_gebuehr_betrag` bleibt vorerst leer.
- Regel: `faellig = nicht_befreit AND (jetzt > start − 2h)`. Premium (`storno_gebuehr_befreit`) nie.
- **Storno ruft `verarbeiteWarteliste`** (nur künftiger, geplanter Termin) → schließt die
  FZ-002-Schleife (Platz frei → Nachrücken).

### Alternativen verworfen
- Gebührenbetrag (50 % Kurspreis) schon in v1 berechnen: „Kurspreis" bei Flat-Tarifen
  undefiniert (spec §8) → verschoben (Backlog „Später").
- Frist pro Kurstyp: mehr Modell-/Pflegeaufwand ohne bestätigten Bedarf.

### Konsequenzen
- Positiv: Storno vollständig + wartelisten-integriert; Gebühren-Regel testbar (`verify:fz003`).
- Negativ/Risiko: Frist-/Gebührenwerte sind Annahmen (mit Kundin bestätigen); ohne Betrag ist die finanzielle Abwicklung manuell.

---

## 2026-07-03 — FZ-002: Warteliste-Design (Obergrenze, Engine, Trigger)

**Kontext:** Umsetzung BR2/BR3. Offene Punkte aus der Spec: konkreter Obergrenzen-
Zahlwert und ob pro Termin/Kurstyp; „automatisches" Nachrücken nach 30 Min; Kanal.

### Entscheidung
- **Obergrenze `MAX_WARTELISTE = 5` pro Kurstermin** (Annahme aus spec-Beispiel §8;
  „pro Termin" gewählt) — zentrale Konstante, mit Kundin zu bestätigen.
- **Partieller Unique-Index** auf `wartelisteneintrag` (nur `wartend`/`benachrichtigt`)
  statt vollem Unique — analog `buchung`; erlaubt Wieder-Anstellen nach `abgelaufen`.
- **Nachrück-Engine `verarbeiteWarteliste(kt)`** (idempotent): verfallen lassen +
  nachrücken; „freie Plätze" = kapazitaet − bestätigte − laufende Reservierungen
  (`benachrichtigt` mit Frist). Ein Angebot reserviert seinen Platz für 30 Min.
- **Zwei Trigger:** (1) frei werdender Platz → Storno ruft die Engine (**FZ-003**);
  (2) Fristablauf → Cron-Endpoint `GET /api/cron/warteliste` (Bearer `CRON_SECRET`,
  Vercel Cron / pg_cron).
- **`position`** wird dynamisch aus `zeitstempel` berechnet, nicht gespeichert (keine Drift).
- **Benachrichtigung** als Stub (`lib/notify.ts`); Kanal offen (BR2/BR8).

### Alternativen verworfen
- Gespeicherte `position` mit Umnummerierung bei jeder Änderung: fehleranfällig (Drift).
- Reines Cron-Nachrücken ohne Storno-Trigger: würde freie Plätze erst verzögert vergeben.
- Sofort-Nachrücken ohne 30-Min-Reservierung: widerspricht BR2 (Bestätigungsfenster).

### Konsequenzen
- Positiv: FIFO/Obergrenze tarif-unabhängig (BR3); Engine an mehreren Stellen wiederverwendbar; verifiziert (`verify:fz002`).
- Negativ/Risiko: Live-Nachrücken bei frei werdendem Platz erst mit FZ-003 aktiv; Cron muss deployed/geplant werden, damit Fristen ohne Interaktion ablaufen.

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
