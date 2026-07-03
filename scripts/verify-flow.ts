import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../lib/db";
import { benutzer, buchung, kurstermin, kurstyp } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";

// End-to-End-Flow gegen die laufende App (npm run dev auf :3000):
// echtes Login → authentifiziert /kurse lesen → als Mitglied buchen → /kurse erneut
// lesen (Read-after-write) → Buchung zurücksetzen. Ausführen mit env + MEMBER_PASSWORD.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PW = process.env.MEMBER_PASSWORD!;
const APP = "http://localhost:3000";
const EMAIL = "member@fitzone.test";

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function getKurse(cookie: string) {
  const res = await fetch(`${APP}/kurse`, {
    headers: { cookie },
    redirect: "manual",
  });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, body };
}

async function main() {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];

  // 1. Echtes Login über Supabase (Passwort-Grant)
  const tokenRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON },
      body: JSON.stringify({ email: EMAIL, password: PW }),
    },
  );
  const session = await tokenRes.json();
  pruefe(
    "Login (Passwort-Grant) liefert access_token",
    !!session.access_token,
    JSON.stringify(session).slice(0, 120),
  );
  if (!session.access_token) process.exit(1);

  // Session als @supabase/ssr-Cookie (base64url)
  const cookieName = `sb-${ref}-auth-token`;
  const cookieValue =
    "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const cookie = `${cookieName}=${cookieValue}`;

  // 2. /kurse authentifiziert lesen
  const vorher = await getKurse(cookie);
  pruefe("GET /kurse authentifiziert → 200 (Guard bestanden)", vorher.status === 200, `HTTP ${vorher.status}`);
  pruefe("Terminliste zeigt Kurse (Yoga)", vorher.body.includes("Yoga"));
  pruefe("Terminliste zeigt freie Plätze", vorher.body.includes("frei"));

  // 3. Mitglied aus dem Token auflösen (wie getBenutzer)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` },
  });
  const user = await userRes.json();
  const [b] = await db.select().from(benutzer).where(eq(benutzer.benutzerId, user.id));
  pruefe("Token → benutzer, rolle=mitglied", b?.rolle === "mitglied", `rolle=${b?.rolle}`);
  pruefe("benutzer ist mit Mitglied verknüpft", !!b?.mitgliedId);
  if (!b?.mitgliedId) process.exit(1);

  // 4. Einen buchbaren Yoga-Termin wählen und als dieses Mitglied buchen
  const [termin] = await db
    .select({ id: kurstermin.kursterminId, kap: kurstermin.kapazitaet })
    .from(kurstermin)
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(
      and(
        eq(kurstyp.name, "Yoga"),
        eq(kurstermin.status, "geplant"),
        gt(kurstermin.start, new Date()),
      ),
    )
    .orderBy(asc(kurstermin.start));
  pruefe("buchbarer Yoga-Termin vorhanden", !!termin);
  if (!termin) process.exit(1);

  const ergebnis = await bucheKurstermin(b.mitgliedId, termin.id);
  pruefe(
    "Buchung als Mitglied → bestätigt (oder bereits gebucht)",
    ergebnis.status === "bestaetigt" || ergebnis.status === "bereits_gebucht",
    `status=${ergebnis.status}`,
  );

  // 5. /kurse erneut lesen → App zeigt den Termin jetzt als gebucht (read-after-write)
  const nachher = await getKurse(cookie);
  pruefe("GET /kurse zeigt den Termin nun als 'Gebucht'", nachher.body.includes("Gebucht"));

  // 6. Zurücksetzen (Demo bleibt frisch, Script bleibt wiederholbar)
  await db
    .update(buchung)
    .set({ buchungsstatus: "storniert", stornozeitpunkt: new Date() })
    .where(
      and(
        eq(buchung.mitgliedId, b.mitgliedId),
        eq(buchung.kursterminId, termin.id),
        eq(buchung.buchungsstatus, "bestaetigt"),
      ),
    );
  console.log("  ↺ Buchung zurückgesetzt (Demo unverändert).");

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
