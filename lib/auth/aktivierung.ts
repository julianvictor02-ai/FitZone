import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { benutzer, mitglied } from "@/lib/db/schema";
import { PASSWORT_MIN } from "@/lib/auth/konstanten";

// „Konto aktivieren" — Selbstbedienungs-Erstlogin für admin-angelegte Mitglieder.
// Die Mitgliedschaft wird bewusst vom Admin kuratiert (SPEC §2b, §7): der Admin legt nur
// den Mitglied-Datensatz an (name/email/tarif/status), OHNE Auth-Konto. Hier setzt das
// Mitglied selbst ein Passwort und verknüpft es mit dem bestehenden Datensatz — es ist
// KEINE offene Registrierung: es wird nie ein neues Mitglied angelegt.

export type AktivierungErgebnis =
  | { status: "ok" }
  // Neutral: E-Mail unbekannt ODER bereits aktiviert — bewusst nicht unterscheidbar,
  // damit gültige E-Mails nicht enumerierbar sind (Sicherheitsaspekt).
  | { status: "ungueltig" }
  | { status: "passwort_schwach" }
  | { status: "passwort_ungleich" };

// Gibt es zu dieser E-Mail bereits einen Auth-User (= Konto bereits aktiviert)?
async function hatAuthKonto(email: string): Promise<boolean> {
  const rows = (await db.execute(
    sql`select 1 from auth.users where lower(email) = ${email} limit 1`,
  )) as unknown as unknown[];
  return rows.length > 0;
}

// Legt einen Auth-User direkt in auth.* an (wie GoTrue intern) — Passwort als bcrypt via
// pgcrypto, E-Mail sofort bestätigt, kein E-Mail-Versand/Rate-Limit. Spiegelt die erprobte
// Provisionierung (scripts/provision-users.ts). Token-Spalten müssen '' sein (nicht NULL),
// sonst „Database error querying schema" beim Login.
async function erstelleAuthKonto(email: string, password: string): Promise<string> {
  const id = randomUUID();
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

/**
 * Aktiviert das Konto zu einer E-Mail: setzt ein Passwort und verknüpft es mit dem
 * bestehenden Mitglied-Datensatz (gleiche mitglied_id). Nur zulässig, wenn ein Mitglied
 * mit dieser E-Mail existiert und noch KEIN Auth-Konto hat — sonst neutraler Fehler.
 */
export async function aktiviereKonto(
  emailRoh: string,
  passwort: string,
  passwortBestaetigung: string,
): Promise<AktivierungErgebnis> {
  if (passwort.length < PASSWORT_MIN) return { status: "passwort_schwach" };
  if (passwort !== passwortBestaetigung) return { status: "passwort_ungleich" };

  const email = emailRoh.trim().toLowerCase();
  if (!email) return { status: "ungueltig" };

  // Mitglied muss existieren (case-insensitiv) …
  const [m] = await db
    .select({ id: mitglied.mitgliedId })
    .from(mitglied)
    .where(sql`lower(${mitglied.email}) = ${email}`);
  if (!m) return { status: "ungueltig" };

  // … und darf noch kein Auth-Konto haben (kein erneutes Aktivieren).
  if (await hatAuthKonto(email)) return { status: "ungueltig" };

  const authId = await erstelleAuthKonto(email, passwort);
  await db
    .insert(benutzer)
    .values({ benutzerId: authId, email, rolle: "mitglied", mitgliedId: m.id })
    .onConflictDoNothing();

  return { status: "ok" };
}
