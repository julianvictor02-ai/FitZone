# FZ-006 — Mitgliederstammdaten (admin-gepflegt) + Auth-Grundlage

_Konzept / Plan. Quelle: `docs/spec.md §2, §6 (NFR Rollen), §7`. Status: in-progress._

## Ziel

Admin (Lisa) pflegt die Mitglieder-Stammdaten (Name, E-Mail, Tarif, Status,
Mitgliedschaft bis). Basis für alle anderen Features. Erfordert eine Auth- und
Rollen-Grundlage (Admin/Trainer/Mitglied), da „admin-gepflegt" eine Rollenprüfung
voraussetzt.

## Akzeptanzkriterien

- [ ] Nur angemeldete Admins erreichen `/admin/mitglieder`; andere werden umgeleitet.
- [ ] Admin kann ein Mitglied anlegen (Name, E-Mail, Tarif, optional Mitgliedschaft bis).
- [ ] Admin kann Tarif und Status (`aktiv`/`pausiert`) eines Mitglieds ändern.
- [ ] Mitglieder-/Trainer-Selbstverwaltung ist NICHT möglich (Tarifwechsel = Admin-Sache, vgl. FZ-017 killed).
- [ ] Login/Logout funktioniert; die Rolle wird aus der `benutzer`-Tabelle gelesen.

## Architektur-Entscheidungen (siehe decisions.md)

- **Identität:** Tabelle `benutzer` (`benutzer_id` = Supabase `auth.users.id`) mit
  `rolle`-Enum und optionaler Verknüpfung zu `mitglied_id` / `trainer_id`. Admin
  hat keine der beiden FKs.
- **Autorisierung app-seitig:** Guards in Server Components / Server Actions
  (`requireRolle`), da Drizzle über eine Service-Connection läuft und RLS umgeht.
  RLS bleibt als späteres Defense-in-Depth (eigener Folge-Task).

## Bausteine

- Schema: `benutzer`-Tabelle + `rolle`-Enum (`lib/db/schema.ts`).
- Session: `middleware.ts` + `lib/supabase/middleware.ts` (Token-Refresh).
- Auth-Helfer: `lib/auth/benutzer.ts` — `getBenutzer()`, `requireRolle()`.
- Login/Logout: `app/login/page.tsx` + `app/login/actions.ts`.
- Admin-CRUD: `app/admin/mitglieder/page.tsx` + `actions.ts`.
- Seed: `scripts/seed.ts` (Tarife + Kurstypen), `npm run db:seed`.

## Admin-Bootstrap (einmalig, sobald Supabase steht)

1. `.env.local` füllen, `npm run db:push` (Schema), `npm run db:seed` (Referenzdaten).
2. Admin-Auth-Konto in Supabase anlegen: Dashboard → Authentication → Add user
   (E-Mail + Passwort), oder Sign-up.
3. `benutzer`-Zeile für dieses Konto setzen (UUID = auth.users.id):
   ```sql
   insert into benutzer (benutzer_id, email, rolle)
   values ('<auth-user-uuid>', '<email>', 'admin');
   ```
4. Login auf `/login` → Startseite zeigt „Mitglieder-Verwaltung".

## Bewusst NICHT in FZ-006 (Folge-Arbeit)

- **Mitglieder-/Trainer-Login-Provisionierung** (Einladung: Mitglied-Stammdatensatz
  ↔ Supabase-Konto ↔ `benutzer`-Zeile automatisch verknüpfen). FZ-006 legt zunächst
  nur die Stammdaten an; das Verknüpfen von Login-Konten folgt.
- **RLS-Policies** als Defense-in-Depth.
- Trainer-Verwaltung/-Login (Teil von FZ-005).

## Verifikation (manuell, sobald Supabase steht)

1. Ohne Login `/admin/mitglieder` öffnen → Redirect zu `/login`.
2. Als Nicht-Admin (rolle=mitglied) → Redirect zur Startseite.
3. Als Admin: Mitglied anlegen → erscheint in Liste; Tarif/Status ändern → persistiert.
