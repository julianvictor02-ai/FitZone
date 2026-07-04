import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Verbindung zur Supabase-Postgres. DATABASE_URL = Supabase Connection String
// (Transaction-Pooler-URL für Serverless empfohlen). prepare:false wegen Pooler.
//
// Der Client wird **lazy** erzeugt — erst bei erster Nutzung, nicht beim Import. So parst
// der Build (Next.js „collect page data") NICHT die DATABASE_URL: der Build hängt damit
// nicht an einer (evtl. noch unsauberen) Env-Variable; DATABASE_URL wird nur zur Laufzeit
// gebraucht. Der `db`-Export bleibt unverändert nutzbar (Proxy leitet alle Aufrufe weiter).

type DB = PostgresJsDatabase<typeof schema>;

let instanz: DB | null = null;

function getDb(): DB {
  if (!instanz) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt");
    const client = postgres(connectionString, { prepare: false });
    instanz = drizzle(client, { schema });
  }
  return instanz;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const inst = getDb();
    const value = inst[prop as keyof DB];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(inst) : value;
  },
});
