# FitZone

Kursbuchungs- und Verwaltungs-App für das FitZone-Studio (Modul „Smart Applications").
Projektdoku und -methodik: siehe [`CLAUDE.md`](./CLAUDE.md) und [`docs/`](./docs).

## Stack

Next.js (App Router, TypeScript) · Supabase (PostgreSQL + Auth + RLS) · Drizzle ORM · Tailwind CSS
→ Begründung in [`docs/decisions.md`](./docs/decisions.md), Details in [`docs/architecture.md`](./docs/architecture.md).

## Setup

```bash
npm install
cp .env.example .env.local   # dann Supabase-Werte eintragen
```

Benötigte Env-Variablen (Supabase Dashboard → Project Settings):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`.

## Entwicklung

```bash
npm run dev          # Dev-Server auf http://localhost:3000
npm run build        # Production-Build
npm run lint         # ESLint
```

## Datenbank (Drizzle)

Schema: [`lib/db/schema.ts`](./lib/db/schema.ts) (entspricht dem Datenmodell aus `docs/architecture.md`).

```bash
npm run db:generate  # SQL-Migration aus Schema erzeugen (→ ./drizzle)
npm run db:migrate   # Migration gegen DATABASE_URL ausführen
npm run db:push      # Schema direkt in die DB pushen (Dev)
npm run db:studio    # Drizzle Studio öffnen
```

## Struktur

```
app/            Next.js App Router (Seiten, Layouts)
lib/db/         Drizzle: Schema + DB-Client
lib/supabase/   Supabase-Clients (Browser + Server)
docs/           Anforderungen, Backlog, Architektur, Entscheidungen
```

## Nächster Schritt

Backlog `FZ-001` — Kursbuchung mit Auto-Bestätigung. Siehe [`docs/backlog.md`](./docs/backlog.md).
