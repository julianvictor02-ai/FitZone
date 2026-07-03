import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Verbindung zur Supabase-Postgres. DATABASE_URL = Supabase Connection String
// (Pooler-URL für Serverless empfohlen). prepare:false wegen Transaction-Pooler.
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
