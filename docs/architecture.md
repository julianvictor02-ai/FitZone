# architecture.md — FitZone

_Stand: 2026-07-03_

Technische Wahrheit: Datenmodell, Stack, Standards. Anforderungen siehe `docs/spec.md`,
Entscheidungen mit Begründung siehe `docs/decisions.md`.

---

## Tech-Stack

Festgelegt am 2026-07-03 (siehe `decisions.md`). **Next.js + Supabase.**

| Ebene | Wahl |
|-------|------|
| Sprache/Framework | TypeScript, Next.js (App Router) — FE + BE (Route Handlers / Server Actions) |
| Datenbank | PostgreSQL via Supabase |
| Auth/RBAC | Supabase Auth + Row Level Security (Rollen: Admin/Trainer/Mitglied) |
| ORM | Drizzle |
| Jobs/Timer | Supabase Edge Functions / `pg_cron` (30-Min-Nachrück-Fenster, BR2) |
| Mail/Benachrichtigung | Resend (Kanal endgültig offen, `spec.md §8`) |
| Deployment | Vercel |

Diese Wahl deckt die harten Rahmenbedingungen der Spec ab:

- **Relationale DB / transaktionale Integrität** — atomare Kapazitätsprüfung, Unique-Constraints (BR1, BR2). Explizit per Transaktion/DB-Constraint absichern, nicht dem ORM überlassen.
- **Server-seitige Business-Logik** — Validierungen in Server Actions / Route Handlers, nicht clientseitig umgehbar.
- **Rollenbasierte Zugriffskontrolle (RBAC)** — 3 Rollen, DB-seitig via RLS erzwungen.
- **Job-/Timer-Mechanismus** — `pg_cron` / Edge Functions für das 30-Min-Fenster (BR2).
- **Sichtbarkeit/Datenschutz** — nur eigene Daten + nur Zahl freier Plätze via RLS (Cross-Member-/Cross-Trainer-Zugriff testen).
- **Single-Tenant** (nur FitZone) als Arbeitsannahme v1.

---

## Datenmodell

Aus `spec.md §10` übernommen (dort mit Quellen-Tags). Verbindliche Grundlage v1.

### Kern-Tabellen
- `mitglied` (mitglied_id PK, name, tarif_id FK, status, mitgliedschaft_bis?, email, login_credential)
- `trainer` (trainer_id PK, name, email)
- `tarif` (tarif_id PK, name[Basic|Plus|Premium], monatspreis?, buchungslimit_pro_monat?, on_demand_zugriff, livestream_zugriff?, storno_gebuehr_befreit, early_access)
- `kurstyp` (kurstyp_id PK, name, standard_kapazitaet_studio?, standard_kapazitaet_livestream?)
- `kurstermin` (kurstermin_id PK, kurstyp_id FK, trainer_id FK, modus[Studio|Livestream], start, kapazitaet, status[geplant|abgesagt|verschoben], stream_link?)
- `on_demand_video` (video_id PK, titel, kurstyp_id FK?, level?, dauer_minuten?, mindest_tarif, plattform, url)

### Junction-Tabellen (n:m)
- `buchung` (buchung_id PK, mitglied_id FK, kurstermin_id FK, buchungsstatus[bestaetigt|storniert], buchungszeitpunkt, stornozeitpunkt?, anwesenheit[offen|anwesend|no_show|entschuldigt], storno_gebuehr_faellig, storno_gebuehr_betrag?, trainer_notiz?) — **Unique(mitglied_id, kurstermin_id)**
- `wartelisteneintrag` (wl_id PK, mitglied_id FK, kurstermin_id FK, zeitstempel, position?, status[wartend|benachrichtigt|nachgerueckt|abgelaufen], benachrichtigt_am?, frist_bis?) — **Unique(mitglied_id, kurstermin_id)**

### Kurstermin-Status-Übergänge
`geplant → verschoben`, `geplant → abgesagt`, `verschoben → abgesagt`.
Bei `abgesagt`/`verschoben`: automatische Benachrichtigung aller Gebuchten (BR8).

---

## Kritische, server-seitig zu erzwingende Validierungen

Referenz: `spec.md §10/§11`, Business Rules `spec.md §4`.

1. Buchung nur wenn `count(bestätigte Buchungen) < kurstermin.kapazitaet` — **atomar** (BR1).
2. Wartelisten-Insert nur wenn `count(wartend) < max_wartelistengroesse` (BR2).
3. Nachrücken: Wartende nach `zeitstempel` ASC; `frist_bis = benachrichtigt_am + 30 Min`; nach Ablauf nächster (BR2). Tarif-unabhängig, kein Premium-Vordrängeln (BR3).
4. Basic: `count(Buchungen im Monat) < 5`; Plus/Premium kein Zähllimit (BR4).
5. Content-Zugriff: `mitglied.tarif >= video.mindest_tarif` (BR7).
6. Storno: setzt `stornozeitpunkt`; `storno_gebuehr_faellig = (nicht Premium) AND (stornozeitpunkt > start − frist)` (BR5).
7. `buchung.buchungszeitpunkt` unveränderbar (Nachweis, NFR).
8. Sichtbarkeit: Mitglieder-Query liefert je Kurstermin nur `freie_plaetze` (Zahl), keine Teilnehmernamen; Trainer nur eigene Kurse (Datenschutz/Rollen).

---

## Empfohlene Bau-Reihenfolge

Aus `spec.md §11`: (1) Buchung → (2) Warteliste/Nachrücken → (3) Selbst-Storno →
(4) Trainer-Login + Anwesenheit → (5) Admin-Verwaltung + Ausfall-Benachrichtigung →
(6) Mitglieder-Selbstansicht. Entspricht `backlog.md` Phase 1.

---

## Offene technische Punkte
Siehe `spec.md §8` (Wartelisten-Obergrenze, Limits, Fristen, Kanäle, Auth-Mechanik).
Jede Klärung, die die Architektur betrifft, als Eintrag in `decisions.md` festhalten.
