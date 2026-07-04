import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { benutzer, mitglied, trainer, tarif } from "../lib/db/schema";

// Legt Login-Konten an (Supabase-Signup über den Anon-Key) und verknüpft sie mit dem
// Domänenmodell (mitglied/trainer + benutzer-Rolle). Idempotent. Bestätigt die E-Mail
// direkt (auth.users.email_confirmed_at), damit sofort einloggbar. Testet am Ende jeden Login.
// Ausführen: node --import tsx --env-file=.env.local scripts/provision-users.ts

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PW = "fitzone123";

type Rolle = "mitglied" | "trainer";
type Konto = { email: string; rolle: Rolle; name: string; tarif?: "Basic" | "Plus" | "Premium" };

const KONTEN: Konto[] = [
  { email: "anna@fitzone.de", rolle: "mitglied", name: "Anna Becker", tarif: "Plus" },
  { email: "ben@fitzone.de", rolle: "mitglied", name: "Ben Krüger", tarif: "Basic" },
  { email: "clara@fitzone.de", rolle: "mitglied", name: "Clara Weiß", tarif: "Premium" },
  { email: "marie@fitzone.de", rolle: "trainer", name: "Marie" },
];

// Legt einen Auth-User direkt an (auth.users + auth.identities), wie GoTrue es intern
// tut — ohne E-Mail-Versand (kein Rate-Limit). Passwort als bcrypt via pgcrypto.
async function createAuthUser(email: string, password: string): Promise<string> {
  const id = randomUUID();
  // Token-Spalten müssen '' sein (nicht NULL) — GoTrue scannt sie in non-null Strings,
  // sonst „Database error querying schema" beim Login.
  await db.execute(sql`
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change, email_change_token_new,
       email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values
      ('00000000-0000-0000-0000-000000000000', ${id}::uuid, 'authenticated', 'authenticated',
       ${email}, extensions.crypt(${password}, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', '', '', '', '', '')
  `);
  await db.execute(sql`
    insert into auth.identities
      (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(), ${id}::uuid, 'email', ${id},
       ${JSON.stringify({ sub: id, email, email_verified: true, phone_verified: false })}::jsonb,
       now(), now(), now())
  `);
  return id;
}

async function authUser(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const rows = (await db.execute(
    sql`select id, email_confirmed_at is not null as confirmed from auth.users where email = ${email} limit 1`,
  )) as unknown as Array<{ id: string; confirmed: boolean }>;
  return rows.length ? rows[0] : null;
}

async function login(email: string): Promise<string> {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  const j = await r.json();
  return j.access_token ? "OK" : `FEHLER ${r.status}: ${j.error_description || j.msg || j.message}`;
}

async function main() {
  for (const k of KONTEN) {
    // 1. Auth-Konto sicherstellen (direkt in auth.*, kein E-Mail-Rate-Limit).
    let u = await authUser(k.email);
    if (!u) {
      await createAuthUser(k.email, PW);
      u = await authUser(k.email);
      if (!u) throw new Error(`Anlegen fehlgeschlagen für ${k.email}`);
    }
    // 2. E-Mail bestätigen (falls nötig), damit sofort einloggbar.
    if (!u.confirmed) {
      await db.execute(sql`update auth.users set email_confirmed_at = now() where id = ${u.id}::uuid`);
    }

    // 3. Domänenprofil + benutzer-Verknüpfung (idempotent).
    if (k.rolle === "mitglied") {
      const [t] = await db.select().from(tarif).where(eq(tarif.name, k.tarif!));
      let m = (await db.select().from(mitglied).where(eq(mitglied.email, k.email)))[0];
      if (!m) {
        m = (
          await db.insert(mitglied).values({ name: k.name, email: k.email, tarifId: t.tarifId }).returning()
        )[0];
      }
      await db
        .insert(benutzer)
        .values({ benutzerId: u.id, email: k.email, rolle: "mitglied", mitgliedId: m.mitgliedId })
        .onConflictDoNothing();
    } else {
      let tr = (await db.select().from(trainer).where(eq(trainer.email, k.email)))[0];
      if (!tr) {
        tr = (await db.insert(trainer).values({ name: k.name, email: k.email }).returning())[0];
      }
      await db
        .insert(benutzer)
        .values({ benutzerId: u.id, email: k.email, rolle: "trainer", trainerId: tr.trainerId })
        .onConflictDoNothing();
    }

    console.log(`  ${k.email.padEnd(22)} rolle=${k.rolle}${k.tarif ? ` tarif=${k.tarif}` : ""} → Login: ${await login(k.email)}`);
  }

  console.log("\nFertig. Passwort für alle neuen Konten: " + PW);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
