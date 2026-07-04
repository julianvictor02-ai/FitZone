# decisions.md — FitZone

_Chronologischer Log von Architektur- und Produktentscheidungen (neueste oben).
Format je Eintrag: Kontext → Entscheidung → verworfene Alternativen → Konsequenzen._

---

## 2026-07-04 — FZ-010: Buchungslimit — Zählweise, Monatsdefinition, Durchsetzungspunkte

**Kontext:** Umsetzung BR4 (Basic 5/Monat, Plus/Premium unbegrenzt). Spec §8 offen:
Kalendermonat vs. rollierend; zusätzlich ungeklärt: zählt der Buchungs-Zeitpunkt oder das
Kurs-Datum, und gibt ein Storno einen Platz frei?

### Entscheidung
- **Zählung nach Kurs-Datum, Kalendermonat**: „max. 5 Kurse pro Kalendermonat", gemessen an
  `kurstermin.start`. Passt zu Lisas Beispiel („sechs Kurse in einer Woche") besser als eine
  Zählung nach Buchungs-Zeitpunkt und verhindert Vorausbuchen zum Umgehen des Limits.
- **Nur aktive (bestätigte) Buchungen zählen** → **Storno gibt einen Platz frei**. Missbrauch
  (buchen/stornieren) fängt das No-Show-Tracking (BR6), nicht das Zähllimit.
- **Durchsetzung an allen Buchungs-Erzeugungspunkten**: Direktbuchung (`bucheKurstermin`) und
  Warteliste-Nachrücken (`bestaetigeNachrueckung`) — beide erzeugen eine Buchung. Neuer
  Status `limit_erreicht`. Gemeinsame Prüfung in `lib/booking/limit.ts` (`pruefeMonatslimit`,
  innerhalb der bestehenden Transaktion).
- **Warteliste-Beitritt bleibt frei** (kein Booking); das Limit greift erst beim Nachrücken.
  Ein am Limit angebotenes Nachrücken wird abgelehnt, das Angebot bleibt bis Fristablauf
  bestehen (Mitglied könnte anderweitig Platz freimachen).
- **Keine Atomaritäts-Sperre über Termine hinweg**: die Monatszählung läuft in der Buchungs-
  Transaktion, aber gleichzeitige Buchungen **verschiedener** Termine durch dasselbe Mitglied
  werden nicht serialisiert (anders als die Kapazität pro Termin). Bewusst akzeptiert —
  Einzelnutzer-Aktion, kein Überbuchungs-/Sicherheitsrisiko.

### Alternativen verworfen
- Zählung nach Buchungs-Zeitpunkt: erlaubt Umgehung durch Vorausbuchen; „im Monat" meint
  eher den Kurszeitraum.
- Storno zählt weiter mit (kein Freigeben): bestraft legitimes Umbuchen; Missbrauch deckt BR6.
- Limit nur bei Direktbuchung: ließe eine offensichtliche Umgehung über die Warteliste offen.
- Mitglied-Row-Lock für exakte Atomarität: unnötiger Aufwand für einen Near-Zero-Fall.

### Konsequenzen
- Positiv: BR4 durchgängig erzwungen; verifiziert (`verify:fz010`, 9/9) inkl. Nachrücken,
  Monatsgrenze und Storno-Freigabe; keine Regression (fz001–003 grün).
- Negativ/Risiko: Monatsdefinition (Kalendermonat vs. rollierend) und Zählweise sind Annahmen
  — mit Kundin zu bestätigen (spec §8). Monatsgrenzen nutzen server-lokale Monatsanfänge.

---

## 2026-07-04 — FZ-007: Mitglieder-Selbstansicht — read-only, eigene Daten app-seitig

**Kontext:** Umsetzung FZ-007 (Mitglieder-Selbstansicht). §2b/§7/§11: Mitglied sieht nur
eigene Daten (Tarif, Status, `mitgliedschaft_bis`, eigene Buchungen/Historie,
Wartelisten-Status), **nur lesend**; keine fremden Namen.

### Entscheidung
- **Reine RSC-Seite `app/mein-bereich/page.tsx`, keine Server-Action/Mutation.** Jede Query
  filtert hart auf `mitglied_id = Session-Mitglied` (konsistent mit FZ-005/§2b, RLS später).
  Tarif/Status/Pausieren bleiben Admin-Sache (FZ-017 killed) — bewusst keine Bearbeitung.
- **Wartelisten-Position** wird wie in der Kursliste dynamisch aus `zeitstempel` berechnet
  (FIFO, BR3), nicht gespeichert — konsistent mit FZ-002.
- **Buchungen inkl. Historie** (bestätigt + storniert) in einer Liste, jüngste zuerst; zeigt
  den unveränderbaren `buchungszeitpunkt` (Nachweis, NFR), Anwesenheit und Storno-Infos.
- **Kein Schema-/Engine-Change** — Feature ist reine Lese-Aggregation vorhandener Daten.

### Alternativen verworfen
- Editierbare Felder (z. B. Tarifwunsch): widerspricht §2b/„nur lesend" und FZ-017.
- Gespeicherte Wartelisten-Position: Drift-anfällig (siehe decisions FZ-002).

### Konsequenzen
- Positiv: Selbstansicht ohne neue Angriffsfläche (read-only); Isolation verifiziert
  (`verify:fz007`, 9/9: nur eigene Buchungen/WL, korrekte FIFO-Position A=1/B=2); build grün.
- Negativ/Risiko: Sichtbarkeit rein app-seitig durchgesetzt (kein RLS-Netz darunter, bis
  ergänzt) — jede Query muss den `mitglied_id`-Filter konsequent setzen.

---

## 2026-07-04 — FZ-005: Trainer-Ansicht — Sichtbarkeit app-seitig, Login-Provisionierung

**Kontext:** Umsetzung FZ-005 (Trainer-Login: eigener Kursplan + Anwesenheit abhaken) auf
der FZ-004-Engine. Zwei Punkte: (1) Wie wird „Trainer sieht nur eigene Kurse" (§2b)
durchgesetzt? (2) Der `/trainer`-Bereich ist ohne verknüpftes Trainer-Konto unerreichbar.

### Entscheidung
- **Sichtbarkeit app-seitig** in der Seiten-Query erzwungen: `app/trainer/page.tsx` filtert
  hart auf `trainer_id = Session-Trainer` (+ `status != abgesagt`); Teilnehmer werden nur
  für diese Termin-IDs geladen. Konsistent mit dem RBAC-Ansatz aus FZ-006 (Guards +
  gefilterte Drizzle-Queries, RLS als spätere Härtung). **Teilnehmernamen sind hier
  zulässig** (Trainer sieht Teilnehmer eigener Kurse, §2b) — anders als in der
  Mitglieder-Ansicht (nur Platz-Zahl).
- **Abhaken ab Kursbeginn**: die UI deaktiviert die Buttons, solange `start > jetzt`
  (die Engine lehnt es zusätzlich mit `zu_frueh` ab — FZ-004).
- **Login-Provisionierung** für den Trainer in `scripts/bootstrap.ts` ergänzt (best effort:
  nur wenn Auth-Konto `marie@fitzone.test` existiert) + vergangener Demo-Kurs mit
  Teilnehmer, damit die Anwesenheit sofort demonstrierbar ist.

### Alternativen verworfen
- Sichtbarkeit erst über RLS: RLS ist projektweit als spätere Defense-in-Depth
  eingeplant (decisions FZ-006), nicht als primäre Durchsetzung.
- Ownership-Prüfung nur in der Engine (nicht in der Seiten-Query): die Seite würde sonst
  fremde Termine laden und erst beim Abhaken scheitern — Datenleck der Terminliste/Namen.

### Konsequenzen
- Positiv: FZ-004+005 gemeinsam nutzbar; Isolation verifiziert (`verify:fz005`, 8/8);
  `next build` grün.
- Negativ/Risiko: Browser-End-to-End (echter Trainer-Login) konnte mangels
  Trainer-Auth-Konto (kein Service-Role-Key zum Anlegen) nicht gefahren werden — offen wie
  die Mitglieder-Login-Provisionierung (FZ-006). Nach Anlegen von `marie@fitzone.test` +
  `bootstrap` manuell nachholbar.

---

## 2026-07-04 — FZ-004: Anwesenheitserfassung — Zeitstempel-Spalte, Engine-Scope, Zeitgrenze

**Kontext:** Umsetzung FZ-004. Drei Punkte: (1) Das Feature heißt „Anwesenheitserfassung
**mit Zeitstempel**", aber die Buchung-Entität (spec §2) hat nur das Enum `anwesenheit`,
keinen Erfassungs-Zeitpunkt. (2) Backlog trennt FZ-004 (Logik) von FZ-005 (Trainer-UI).
(3) Spec §2 sagt „nach Kursende" erfassen — modelliert ist aber nur `start` (kein Kursende).

### Entscheidung
- **Neue Spalte `buchung.anwesenheit_erfasst_am`** (nullable `timestamptz`, Migration
  `drizzle/0002`). Erfüllt „mit Zeitstempel" wörtlich und die Audit-NFR; wird bei jeder
  Erfassung gesetzt, bei Korrektur auf `offen` wieder `null`. `buchungszeitpunkt` bleibt
  unangetastet (NFR, „nicht verhandelbar").
- **Scope = Engine + Server-Action**, keine UI. `lib/attendance/anwesenheit.ts`
  (`erfasseAnwesenheit`) erzwingt Trainer-Ownership (§2b) und aktive Buchung;
  `app/trainer/actions.ts` löst die Trainer-Identität aus der Session. Die **Trainer-
  Oberfläche bleibt FZ-005**. Verifiziert per `verify:fz004` (10/10, Direkt-Lib wie FZ-001–003).
- **Zeitgrenze = Kursbeginn** (`start <= jetzt` → sonst `zu_frueh`), da kein Kursende
  modelliert ist. Pragmatische Auslegung von „nach Kursende".

### Alternativen verworfen
- „mit Zeitstempel" als durch `buchungszeitpunkt` abgedeckt lesen (keine Spalte): der
  Erfassungszeitpunkt wäre nicht nachweisbar — widerspricht dem Wortlaut + Audit-NFR.
- FZ-005 (Trainer-UI) gleich mitziehen: verwässert den Backlog-Schnitt; die UI ist eigenes Item.
- Echtes Kursende-Feld einführen: Modell-/Pflegeaufwand ohne bestätigten Bedarf (spec §8).

### Konsequenzen
- Positiv: auditierbare Anwesenheit (wer/wann); testbare, wiederverwendbare Engine als
  Basis für Trainer-UI (FZ-005) und No-Show-Auswertung (BR6/FZ-013).
- Negativ/Risiko: Action noch ohne Aufrufer bis FZ-005; „nach Kursende"=Kursbeginn und der
  Admin-Erfassungspfad (§2b) sind Annahmen — bei Bedarf ergänzen/mit Kundin bestätigen.

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
