import { and, eq, gt, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  benutzer,
  mitglied,
  trainer,
  tarif,
  kurstyp,
  kurstermin,
  buchung,
  onDemandVideo,
} from "../lib/db/schema";

// Einmaliger Bootstrap für die lokale Verifikation (idempotent):
// verknüpft die im Supabase-Dashboard angelegten Auth-Konten mit Rollen und legt
// ein Test-Mitglied, einen Trainer und buchbare Demo-Kurstermine an.
// Voraussetzung: Auth-User admin@fitzone.test und member@fitzone.test existieren.
// Ausführen: env laden, dann `tsx scripts/bootstrap.ts`.

const ADMIN_EMAIL = "admin@fitzone.test";
const MEMBER_EMAIL = "member@fitzone.test";
// Muss mit dem Login-Provisioning (scripts/provision-users.ts) übereinstimmen, sonst
// entstehen zwei „Marie"-Trainer-Datensätze: der Login hängt am einen, die per bootstrap
// angelegten Kurstermine (und damit alle Buchungen) am anderen — dann sieht die
// eingeloggte Marie ihre Teilnehmer nicht. Beide nutzen daher marie@fitzone.de.
const TRAINER_EMAIL = "marie@fitzone.de";

async function authId(email: string): Promise<string | null> {
  const rows = (await db.execute(
    sql`select id from auth.users where email = ${email} limit 1`,
  )) as unknown as Array<{ id: string }>;
  return rows.length ? rows[0].id : null;
}

async function main() {
  const adminId = await authId(ADMIN_EMAIL);
  const memberId = await authId(MEMBER_EMAIL);
  if (!adminId)
    throw new Error(`Kein Auth-Konto für ${ADMIN_EMAIL} — im Dashboard anlegen.`);
  if (!memberId)
    throw new Error(`Kein Auth-Konto für ${MEMBER_EMAIL} — im Dashboard anlegen.`);

  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [kHIIT] = await db.select().from(kurstyp).where(eq(kurstyp.name, "HIIT"));

  // Admin-Rolle
  await db
    .insert(benutzer)
    .values({ benutzerId: adminId, email: ADMIN_EMAIL, rolle: "admin" })
    .onConflictDoNothing();

  // Test-Mitglied-Profil (idempotent per E-Mail)
  let m = (await db.select().from(mitglied).where(eq(mitglied.email, MEMBER_EMAIL)))[0];
  if (!m) {
    m = (
      await db
        .insert(mitglied)
        .values({ name: "Test Mitglied", email: MEMBER_EMAIL, tarifId: tPlus.tarifId })
        .returning()
    )[0];
  }

  // Mitglied-Rolle mit Verknüpfung
  await db
    .insert(benutzer)
    .values({
      benutzerId: memberId,
      email: MEMBER_EMAIL,
      rolle: "mitglied",
      mitgliedId: m.mitgliedId,
    })
    .onConflictDoNothing();

  // Trainer (idempotent)
  let tr = (await db.select().from(trainer).where(eq(trainer.email, TRAINER_EMAIL)))[0];
  if (!tr) {
    tr = (
      await db
        .insert(trainer)
        .values({ name: "Marie", email: TRAINER_EMAIL })
        .returning()
    )[0];
  }

  // Trainer-Rolle mit Verknüpfung (FZ-005) — best effort: nur wenn ein Auth-Konto
  // marie@fitzone.test existiert, sonst überspringen (Provisionierung offen, s. FZ-006).
  const trainerAuthId = await authId(TRAINER_EMAIL);
  if (trainerAuthId) {
    await db
      .insert(benutzer)
      .values({
        benutzerId: trainerAuthId,
        email: TRAINER_EMAIL,
        rolle: "trainer",
        trainerId: tr.trainerId,
      })
      .onConflictDoNothing();
  }

  // Vergangener Demo-Kurs mit Teilnehmer, damit die Trainer-Anwesenheit (FZ-005) sofort
  // abhakbar ist. Nur anlegen, wenn Marie noch keinen vergangenen Kurs hat (idempotent).
  const vergangen = await db
    .select({ id: kurstermin.kursterminId })
    .from(kurstermin)
    .where(and(eq(kurstermin.trainerId, tr.trainerId), lt(kurstermin.start, new Date())));
  if (vergangen.length === 0) {
    const gestern = new Date(Date.now() - 86_400_000);
    const [ktPast] = await db
      .insert(kurstermin)
      .values({
        kurstypId: kYoga.kurstypId,
        trainerId: tr.trainerId,
        modus: "Studio",
        start: gestern,
        kapazitaet: 5,
        status: "geplant",
      })
      .returning();
    await db
      .insert(buchung)
      .values({ mitgliedId: m.mitgliedId, kursterminId: ktPast.kursterminId, buchungsstatus: "bestaetigt" })
      .onConflictDoNothing();
  }

  // Demo-Kurstermine nur, wenn noch keine künftigen existieren
  const kuenftig = await db
    .select({ id: kurstermin.kursterminId })
    .from(kurstermin)
    .where(and(eq(kurstermin.status, "geplant"), gt(kurstermin.start, new Date())));

  if (kuenftig.length === 0) {
    const morgen = new Date(Date.now() + 86_400_000);
    const uebermorgen = new Date(Date.now() + 2 * 86_400_000);
    await db.insert(kurstermin).values([
      {
        kurstypId: kYoga.kurstypId,
        trainerId: tr.trainerId,
        modus: "Studio",
        start: morgen,
        kapazitaet: 2,
        status: "geplant",
      },
      {
        kurstypId: kHIIT.kurstypId,
        trainerId: tr.trainerId,
        modus: "Livestream",
        start: uebermorgen,
        kapazitaet: 3,
        status: "geplant",
        streamLink: "https://zoom.example/hiit",
      },
    ]);
  }

  // Demo-On-Demand-Videos (FZ-011), nur anlegen, wenn noch keine existieren.
  const vorhandeneVideos = await db.select({ id: onDemandVideo.videoId }).from(onDemandVideo);
  if (vorhandeneVideos.length === 0) {
    await db.insert(onDemandVideo).values([
      { titel: "Yoga Flow für Einsteiger", kurstypId: kYoga.kurstypId, level: "Anfaenger", dauerMinuten: 30, mindestTarif: "Plus", plattform: "Vimeo", url: "https://vimeo.example/yoga-flow" },
      { titel: "HIIT Express 20", kurstypId: kHIIT.kurstypId, level: "Mittel", dauerMinuten: 20, mindestTarif: "Plus", plattform: "Vimeo", url: "https://vimeo.example/hiit-express" },
      { titel: "Premium Deep Core", kurstypId: kYoga.kurstypId, level: "Fortgeschritten", dauerMinuten: 45, mindestTarif: "Premium", plattform: "Vimeo", url: "https://vimeo.example/deep-core" },
    ]);
  }

  // FZ-011 — echtes YouTube-On-Demand-Video (In-App-Player, ab Plus). Idempotent
  // per video_id, damit es auch in bereits befüllten DBs ergänzt wird.
  const YT_ID = "TCtxV8Driso";
  const [ytVorhanden] = await db
    .select({ id: onDemandVideo.videoId })
    .from(onDemandVideo)
    .where(and(eq(onDemandVideo.plattform, "YouTube"), eq(onDemandVideo.url, YT_ID)));
  if (!ytVorhanden) {
    await db.insert(onDemandVideo).values({
      titel: "Lach-Yoga für Einsteiger",
      kurstypId: kYoga.kurstypId,
      mindestTarif: "Plus",
      plattform: "YouTube",
      url: YT_ID,
    });
  }

  // FZ-011 — echtes YouTube-On-Demand-Video (In-App-Player, ab Plus). Idempotent
  // per video_id, damit es auch in bereits befüllten DBs ergänzt wird.
  const YT_ID_HIIT = "BwvCBEfFJls";
  const [ytHiitVorhanden] = await db
    .select({ id: onDemandVideo.videoId })
    .from(onDemandVideo)
    .where(and(eq(onDemandVideo.plattform, "YouTube"), eq(onDemandVideo.url, YT_ID_HIIT)));
  if (!ytHiitVorhanden) {
    await db.insert(onDemandVideo).values({
      titel: "HIIT Workout",
      kurstypId: kHIIT.kurstypId,
      mindestTarif: "Plus",
      plattform: "YouTube",
      url: YT_ID_HIIT,
    });
  }

  const anzahlTermine = (
    await db
      .select({ id: kurstermin.kursterminId })
      .from(kurstermin)
      .where(and(eq(kurstermin.status, "geplant"), gt(kurstermin.start, new Date())))
  ).length;
  const anzahlVideos = (await db.select({ id: onDemandVideo.videoId }).from(onDemandVideo)).length;

  console.log("Bootstrap fertig:");
  console.log(`  Admin:    ${ADMIN_EMAIL} (rolle=admin)`);
  console.log(`  Mitglied: ${MEMBER_EMAIL} → ${m.name} (Tarif Plus)`);
  console.log(`  Trainer:  ${tr.name} (${TRAINER_EMAIL})${trainerAuthId ? " → rolle=trainer verknüpft" : " — kein Auth-Konto, Login-Verknüpfung übersprungen"}`);
  console.log(`  Buchbare Kurstermine: ${anzahlTermine}`);
  console.log(`  On-Demand-Videos: ${anzahlVideos}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
