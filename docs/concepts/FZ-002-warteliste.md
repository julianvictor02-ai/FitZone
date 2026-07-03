# FZ-002 — Warteliste (FIFO, Nachrücken, 30-Min-Fenster, Obergrenze)

_Konzept / Plan. Quelle: `docs/spec.md §4 BR2/BR3`, §7. Status: done._

## Ziel

Ist ein Kurstermin voll, tritt das Mitglied einer Warteliste bei. Wird ein Platz
frei, rückt streng nach Anmeldezeit (FIFO) der/die Nächste nach und erhält ein
30-Minuten-Bestätigungsfenster. Harte Obergrenze, einheitlich für alle Tarife.

## Business Rules

- **BR2:** FIFO über `zeitstempel`; freier Platz → ältester `wartend` wird
  `benachrichtigt` (`frist_bis = jetzt + 30 Min`); Bestätigung → Buchung
  (`nachgerueckt`), sonst `abgelaufen` und der/die Nächste rückt nach; Obergrenze
  nimmt keine Einträge darüber an.
- **BR3:** Obergrenze und FIFO gelten einheitlich — **kein Premium-Vordrängeln**.

## Akzeptanzkriterien (alle per `npm run verify:fz002` grün)

- [x] Voller Kurs → Beitritt als `wartend` mit korrekter Position.
- [x] Nicht voller Kurs → `platz_frei` (regulär buchen statt Warteliste).
- [x] Freier Platz → genau der/die Älteste rückt nach (`benachrichtigt`), nicht spätere.
- [x] Ohne Angebot kann niemand bestätigen; mit Angebot → `nachgerueckt` + Buchung.
- [x] Nach 30 Min ohne Bestätigung → `abgelaufen`, der/die Nächste rückt automatisch nach.
- [x] Über der Obergrenze (`MAX_WARTELISTE = 5`) wird abgelehnt.

## Lösungsansatz

`lib/booking/warteliste.ts`:

- `warteAufKurstermin(m, kt)` — Beitritt (sperrt Kurstermin; Guards: voll?, dup?, cap?).
- `verarbeiteWarteliste(kt)` — **Engine**: lässt abgelaufene Angebote verfallen und
  benachrichtigt so viele Wartende, wie Plätze frei sind. „Frei" = `kapazitaet −
  bestätigte − laufende Reservierungen (benachrichtigt mit Frist)`. Idempotent.
- `bestaetigeNachrueckung(m, kt)` — Angebot innerhalb der Frist → Buchung.

**Auslöser der Engine:** (1) ein frei werdender Platz (Storno → **FZ-003**, muss
`verarbeiteWarteliste` aufrufen); (2) Zeitablauf über den Cron-Endpoint
`GET /api/cron/warteliste` (Bearer `CRON_SECRET`), per Vercel Cron / Supabase pg_cron.

**Schema:** partieller Unique-Index auf aktive Einträge (`wartend`/`benachrichtigt`),
analog `buchung` — erlaubt Wieder-Anstellen nach `abgelaufen`, Historie bleibt.

**Benachrichtigung:** `lib/notify.ts` ist ein Stub (Kanal offen, spec §8 / BR8).

## UI

`/kurse` zeigt je Termin den passenden Zustand: **Buchen** (frei) · **Warteliste
beitreten** (voll) · **Position N** (wartend) · **Nachrücken bestätigen (bis HH:MM)**
(benachrichtigt) · **Gebucht ✓** · **Warteliste voll**.

## Offen / Annahmen

- `MAX_WARTELISTE = 5` **pro Kurstermin** — Annahme aus spec-Beispiel (§8),
  „pro Termin vs. pro Kurstyp" noch zu bestätigen.
- Benachrichtigungskanal (BR2/BR8) noch offen.
- Live-Trigger „Platz frei" braucht **FZ-003** (Storno ruft `verarbeiteWarteliste`).
